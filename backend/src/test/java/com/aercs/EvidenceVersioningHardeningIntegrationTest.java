package com.aercs;

import com.aercs.entity.Activity;
import com.aercs.entity.ActivityType;
import com.aercs.entity.Department;
import com.aercs.entity.Evidence;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.exception.BadRequestException;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.EvidenceVersionRepository;
import com.aercs.repository.UserRepository;
import com.aercs.security.JwtUtil;
import com.aercs.service.EvidenceService;
import com.aercs.service.SupabaseStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression tests for the file-versioning hardening: isolation between records, concurrent
 * changes, storage kept in step with the database, ownership on restore, and legacy records.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class EvidenceVersioningHardeningIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private EvidenceRepository evidenceRepository;
    @Autowired private EvidenceVersionRepository evidenceVersionRepository;
    @Autowired private EvidenceService evidenceService;

    @MockBean private SupabaseStorageService storageService;

    private final Map<String, byte[]> fakeBucket = new ConcurrentHashMap<>();
    private User staff;
    private User chairperson;
    private Activity activity;

    @BeforeEach
    void setUp() {
        fakeBucket.clear();
        evidenceVersionRepository.deleteAll();
        evidenceRepository.deleteAll();
        activityRepository.deleteAll();
        userRepository.deleteAll(userRepository.findAll().stream()
                .filter(u -> u.getRole() != UserRole.ADMIN).toList());

        doAnswer(inv -> {
            fakeBucket.put(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(storageService).upload(anyString(), any(byte[].class), anyString());
        doAnswer(inv -> fakeBucket.get((String) inv.getArgument(0)))
                .when(storageService).download(anyString());
        doAnswer(inv -> {
            String path = inv.getArgument(0);
            if (path != null) fakeBucket.remove(path);
            return null;
        }).when(storageService).delete(anyString());

        staff = saveUser("Hardening Staff", "hardening-staff@test.local", UserRole.DEPT_STAFF);
        chairperson = saveUser("Hardening Chair", "hardening-chair@test.local", UserRole.ACCRED_COORDINATOR);
        activity = saveActivity("Curriculum Review 2026");
    }

    // ------------------------------------------------------------------ isolation

    @Test
    void anotherActivitiesCopyOfTheSameFileIsNotTouchedWhenThisOneGetsANewVersion() throws Exception {
        Activity other = saveActivity("A different activity");
        byte[] shared = "A form both activities attach".getBytes(StandardCharsets.UTF_8);

        UUID mine = upload(activity, "form.pdf", shared);
        UUID theirs = upload(other, "form.pdf", shared);

        // A new version of my copy...
        replace(mine, "form.pdf", "My revised form".getBytes(StandardCharsets.UTF_8), staff)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion").value(2));

        // ...leaves the other activity's record, history and file exactly as they were.
        mvc.perform(get("/api/evidence/" + theirs).cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion").value(1))
                .andExpect(jsonPath("$.fileSize").value(shared.length));
        mvc.perform(get("/api/evidence/" + theirs + "/versions").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/evidence/" + theirs + "/download").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(content().bytes(shared));
        mvc.perform(get("/api/evidence/" + mine + "/versions").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    // ------------------------------------------------------------------ concurrency

    @Test
    void simultaneousReplacementsAreGivenDistinctVersionNumbers() throws Exception {
        UUID evidenceId = upload(activity, "minutes.pdf", "v1 content".getBytes(StandardCharsets.UTF_8));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Callable<MvcResult>> calls = List.of(
                    () -> replaceAfter(ready, go, evidenceId, "first competing revision"),
                    () -> replaceAfter(ready, go, evidenceId, "second competing revision"));
            List<Future<MvcResult>> futures = calls.stream().map(pool::submit).toList();
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            go.countDown();

            Set<Integer> assigned = new TreeSet<>();
            for (Future<MvcResult> future : futures) {
                MvcResult result = future.get(30, TimeUnit.SECONDS);
                assertThat(result.getResponse().getStatus()).isEqualTo(200);
                assigned.add(json.readTree(result.getResponse().getContentAsString()).get("currentVersion").asInt());
            }
            assertThat(assigned).containsExactly(2, 3);
        } finally {
            pool.shutdownNow();
        }

        mvc.perform(get("/api/evidence/" + evidenceId + "/versions").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
        assertThat(fakeBucket).hasSize(3);
    }

    // ------------------------------------------------------------------ ownership

    @Test
    void restoringAnOldVersionDoesNotChangeWhoOwnsTheRecord() throws Exception {
        UUID evidenceId = upload(activity, "plan.pdf", "plan, first draft".getBytes(StandardCharsets.UTF_8));

        // The chairperson uploads a new version, which makes them the record's owner.
        replace(evidenceId, "plan.pdf", "plan, chairperson edit".getBytes(StandardCharsets.UTF_8), chairperson)
                .andExpect(status().isOk());
        mvc.perform(get("/api/evidence/" + evidenceId).cookie(auth(chairperson)))
                .andExpect(jsonPath("$.uploadedById").value(chairperson.getId().toString()));

        String v1Id = versionId(evidenceId, 1);
        mvc.perform(post("/api/evidence/" + evidenceId + "/versions/" + v1Id + "/restore").cookie(auth(chairperson)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion").value(1));

        // v1 was uploaded by the staff member, but restoring it must not hand them the record back.
        mvc.perform(get("/api/evidence/" + evidenceId).cookie(auth(chairperson)))
                .andExpect(jsonPath("$.uploadedById").value(chairperson.getId().toString()));
    }

    // ------------------------------------------------------------------ who can see / change

    @Test
    void staffFromTheSameDepartmentCanReadAnothersEvidenceButNotChangeIt() throws Exception {
        UUID evidenceId = upload(activity, "shared-plan.pdf", "plan".getBytes(StandardCharsets.UTF_8));
        User colleague = saveUser("Colleague", "hardening-colleague@test.local", UserRole.DEPT_STAFF);

        // The details are readable...
        mvc.perform(get("/api/evidence/" + evidenceId).cookie(auth(colleague))).andExpect(status().isOk());
        mvc.perform(get("/api/evidence/" + evidenceId + "/metadata").cookie(auth(colleague)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/evidence/" + evidenceId + "/versions").cookie(auth(colleague)))
                .andExpect(status().isOk());

        // ...but changing them is still the uploader's (or an admin's / chairperson's) job.
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/evidence/" + evidenceId + "/metadata")
                        .cookie(auth(colleague))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"evidenceType\":\"REPORT\",\"relatedOffices\":[],\"tags\":[],\"notes\":\"\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/evidence/" + evidenceId + "/versions/" + versionId(evidenceId, 1))
                        .cookie(auth(colleague)))
                .andExpect(status().isForbidden());
    }

    @Test
    void aChairpersonCanEditMetadataReplaceAndDeleteStaffEvidenceInHerDepartmentButNotAnotherDepartments() throws Exception {
        UUID evidenceId = upload(activity, "dept-plan.pdf", "first draft".getBytes(StandardCharsets.UTF_8));
        User ceaChair = saveUser("CEA Chair", "hardening-cea-chair@test.local",
                UserRole.ACCRED_COORDINATOR, Department.CEA.name());
        String firstMetadata = "{\"evidenceType\":\"REPORT\",\"relatedOffices\":[],\"tags\":[\"draft\"],\"notes\":\"staff note\"}";
        String overwritten = "{\"evidenceType\":\"MEMORANDUM\",\"relatedOffices\":[],\"tags\":[\"final\"],\"notes\":\"chair note\"}";

        // The staff member sets the metadata first.
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/evidence/" + evidenceId + "/metadata").cookie(auth(staff))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(firstMetadata))
                .andExpect(status().isOk());

        // A chairperson of a different department can change nothing.
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/evidence/" + evidenceId + "/metadata").cookie(auth(ceaChair))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(overwritten))
                .andExpect(status().isForbidden());
        replace(evidenceId, "dept-plan.pdf", "cea edit".getBytes(StandardCharsets.UTF_8), ceaChair)
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/evidence/" + evidenceId).cookie(auth(ceaChair))).andExpect(status().isForbidden());

        // The department's chairperson can overwrite the metadata...
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/evidence/" + evidenceId + "/metadata").cookie(auth(chairperson))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(overwritten))
                .andExpect(status().isOk());
        mvc.perform(get("/api/evidence/" + evidenceId + "/metadata").cookie(auth(staff)))
                .andExpect(jsonPath("$.evidenceType").value("MEMORANDUM"))
                .andExpect(jsonPath("$.tags[0]").value("final"))
                .andExpect(jsonPath("$.notes").value("chair note"));

        // ...replace the staff member's file with a new version...
        replace(evidenceId, "dept-plan.pdf", "chair revision".getBytes(StandardCharsets.UTF_8), chairperson)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion").value(2));

        // ...and delete it.
        mvc.perform(delete("/api/evidence/" + evidenceId).cookie(auth(chairperson))).andExpect(status().isOk());
        assertThat(evidenceRepository.existsById(evidenceId)).isFalse();
    }

    // ------------------------------------------------------------------ storage

    @Test
    void deletingAVersionRemovesItsStoredFileAndKeepsTheOthers() throws Exception {
        UUID evidenceId = upload(activity, "report.pdf", "report v1".getBytes(StandardCharsets.UTF_8));
        replace(evidenceId, "report.pdf", "report v2".getBytes(StandardCharsets.UTF_8), staff).andExpect(status().isOk());
        assertThat(fakeBucket).hasSize(2);

        mvc.perform(delete("/api/evidence/" + evidenceId + "/versions/" + versionId(evidenceId, 1)).cookie(auth(staff)))
                .andExpect(status().isOk());

        assertThat(fakeBucket).hasSize(1);
        mvc.perform(get("/api/evidence/" + evidenceId + "/download").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(content().bytes("report v2".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void deletingTheEvidenceRemovesEveryStoredVersion() throws Exception {
        UUID evidenceId = upload(activity, "report.pdf", "report v1".getBytes(StandardCharsets.UTF_8));
        replace(evidenceId, "report.pdf", "report v2".getBytes(StandardCharsets.UTF_8), staff).andExpect(status().isOk());
        assertThat(fakeBucket).hasSize(2);

        mvc.perform(delete("/api/evidence/" + evidenceId).cookie(auth(staff))).andExpect(status().isOk());

        assertThat(fakeBucket).isEmpty();
    }

    @Test
    void aSaveThatFailsLeavesNoOrphanedFileInStorage() throws Exception {
        // A name longer than the database column makes the save fail after the file was uploaded.
        String tooLongName = "x".repeat(300) + ".pdf";
        MockMultipartFile file = new MockMultipartFile(
                "files", tooLongName, "application/pdf", "content".getBytes(StandardCharsets.UTF_8));

        mvc.perform(multipart("/api/activities/" + activity.getId() + "/evidence/upload")
                        .file(file)
                        .cookie(auth(staff)))
                .andExpect(status().is5xxServerError());

        assertThat(evidenceRepository.count()).isZero();
        assertThat(fakeBucket).isEmpty();
    }

    // ------------------------------------------------------------------ uploads that can't be hashed

    @Test
    void anUploadThatCannotBeReadIsRejectedInsteadOfSkippingTheDuplicateCheck() {
        MockMultipartFile unreadable = new MockMultipartFile(
                "files", "broken.pdf", "application/pdf", "content".getBytes(StandardCharsets.UTF_8)) {
            @Override
            public InputStream getInputStream() throws IOException {
                throw new IOException("disk went away");
            }
        };

        assertThatThrownBy(() -> evidenceService.uploadEvidence(
                activity.getId(), List.of(unreadable), staff.getId().toString()))
                .isInstanceOf(BadRequestException.class);

        assertThat(evidenceRepository.count()).isZero();
        assertThat(fakeBucket).isEmpty();
    }

    // ------------------------------------------------------------------ legacy records

    @Test
    void evidenceFromBeforeVersioningIsShownAsV1WithoutWritingAndBackfilledOnFirstChange() throws Exception {
        byte[] legacyBytes = "uploaded long before versioning".getBytes(StandardCharsets.UTF_8);
        Evidence legacy = new Evidence();
        legacy.setActivity(activity);
        legacy.setOriginalFileName("legacy.pdf");
        legacy.setStoredFileName("legacy.pdf");
        legacy.setFilePath(activity.getId() + "/legacy.pdf");
        legacy.setFileType("PDF");
        legacy.setFileSize(legacyBytes.length);
        legacy.setCurrentVersion(1);
        legacy.setUploadedBy(staff);
        legacy = evidenceRepository.save(legacy);
        fakeBucket.put(legacy.getFilePath(), legacyBytes);
        UUID legacyId = legacy.getId();

        // Listing the history shows it as v1 and does not create any rows.
        mvc.perform(get("/api/evidence/" + legacyId + "/versions").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].versionNumber").value(1))
                .andExpect(jsonPath("$[0].isCurrent").value(true));
        assertThat(evidenceVersionRepository.count()).isZero();

        // The first real change backfills v1 so nothing is lost.
        replace(legacyId, "legacy.pdf", "the revised version".getBytes(StandardCharsets.UTF_8), staff)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion").value(2));

        mvc.perform(get("/api/evidence/" + legacyId + "/versions").cookie(auth(staff)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].versionNumber").value(1))
                .andExpect(jsonPath("$[1].versionNote").value("Initial upload"));
        mvc.perform(get("/api/evidence/" + legacyId + "/versions/" + versionId(legacyId, 1) + "/download")
                        .cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(content().bytes(legacyBytes));
    }

    // ------------------------------------------------------------------ helpers

    private User saveUser(String name, String email, UserRole role) {
        return saveUser(name, email, role, Department.CCS.name());
    }

    private User saveUser(String name, String email, UserRole role, String office) {
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setRole(role);
        user.setOffice(office);
        user.setPasswordHash("unused");
        user.setMustChangePw(false);
        return userRepository.save(user);
    }

    private Activity saveActivity(String name) {
        Activity a = new Activity();
        a.setActivityName(name);
        a.setActivityType(ActivityType.MEETING);
        a.setActivityDate(LocalDate.now());
        a.setDepartment(Department.CCS);
        a.setAcademicYear("2026-2027");
        a.setCreatedBy(staff != null ? staff : userRepository.findAll().get(0));
        return activityRepository.save(a);
    }

    private UUID upload(Activity target, String fileName, byte[] bytes) throws Exception {
        String body = mvc.perform(multipart("/api/activities/" + target.getId() + "/evidence/upload")
                        .file(new MockMultipartFile("files", fileName, "application/pdf", bytes))
                        .cookie(auth(staff)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(body).get(0).get("id").asText());
    }

    private org.springframework.test.web.servlet.ResultActions replace(
            UUID evidenceId, String fileName, byte[] bytes, User as) throws Exception {
        return mvc.perform(multipart("/api/evidence/" + evidenceId + "/replace")
                .file(new MockMultipartFile("file", fileName, "application/pdf", bytes))
                .with(req -> { req.setMethod("PUT"); return req; })
                .cookie(auth(as)));
    }

    private MvcResult replaceAfter(CountDownLatch ready, CountDownLatch go, UUID evidenceId, String text) throws Exception {
        ready.countDown();
        assertThat(go.await(10, TimeUnit.SECONDS)).isTrue();
        return replace(evidenceId, "minutes.pdf", text.getBytes(StandardCharsets.UTF_8), staff).andReturn();
    }

    private String versionId(UUID evidenceId, int versionNumber) throws Exception {
        String body = mvc.perform(get("/api/evidence/" + evidenceId + "/versions").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        for (JsonNode version : json.readTree(body)) {
            if (version.get("versionNumber").asInt() == versionNumber) {
                return version.get("id").asText();
            }
        }
        throw new AssertionError("No v" + versionNumber + " in " + body);
    }

    private Cookie auth(User user) {
        return new Cookie("aercs_token", jwtUtil.generateToken(user));
    }
}

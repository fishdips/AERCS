package com.aercs;

import com.aercs.entity.Activity;
import com.aercs.entity.ActivityType;
import com.aercs.entity.Department;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.EvidenceVersionRepository;
import com.aercs.repository.UserRepository;
import com.aercs.security.JwtUtil;
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

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class EvidenceVersioningIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private EvidenceRepository evidenceRepository;
    @Autowired private EvidenceVersionRepository evidenceVersionRepository;

    @MockBean private SupabaseStorageService storageService;

    private final Map<String, byte[]> fakeBucket = new ConcurrentHashMap<>();
    private User staff;
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
            String path = inv.getArgument(0);
            byte[] bytes = inv.getArgument(1);
            fakeBucket.put(path, bytes);
            return null;
        }).when(storageService).upload(anyString(), any(byte[].class), anyString());

        doAnswer(inv -> {
            String path = inv.getArgument(0);
            return fakeBucket.get(path);
        }).when(storageService).download(anyString());

        doAnswer(inv -> {
            String path = inv.getArgument(0);
            if (path != null) fakeBucket.remove(path);
            return null;
        }).when(storageService).delete(anyString());

        staff = new User();
        staff.setName("Staff Member");
        staff.setEmail("versioning-staff@test.local");
        staff.setRole(UserRole.DEPT_STAFF);
        staff.setOffice(Department.CCS.name());
        staff.setPasswordHash("unused");
        staff.setMustChangePw(false);
        staff = userRepository.save(staff);

        activity = new Activity();
        activity.setActivityName("Curriculum Review 2026");
        activity.setActivityType(ActivityType.MEETING);
        activity.setActivityDate(LocalDate.now());
        activity.setDepartment(Department.CCS);
        activity.setAcademicYear("2026-2027");
        activity.setCreatedBy(staff);
        activity = activityRepository.save(activity);
    }

    @Test
    void uploadReplaceAutoVersionAndRestorePreserveFullVersionHistoryAndPreventDuplicates() throws Exception {
        byte[] v1Bytes = "Minutes of Meeting - Draft v1".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile v1File = new MockMultipartFile(
                "files", "minutes.pdf", "application/pdf", v1Bytes);

        // 1. Initial upload creates v1
        String uploadBody = mvc.perform(multipart("/api/activities/" + activity.getId() + "/evidence/upload")
                        .file(v1File)
                        .cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].originalFileName").value("minutes.pdf"))
                .andExpect(jsonPath("$[0].currentVersion").value(1))
                .andReturn().getResponse().getContentAsString();

        UUID evidenceId = UUID.fromString(json.readTree(uploadBody).get(0).get("id").asText());

        // 2. Uploading the exact same content into the same activity is blocked (content deduplication)
        MockMultipartFile duplicateSameActivity = new MockMultipartFile(
                "files", "minutes-copy.pdf", "application/pdf", v1Bytes);
        mvc.perform(multipart("/api/activities/" + activity.getId() + "/evidence/upload")
                        .file(duplicateSameActivity)
                        .cookie(auth(staff)))
                .andExpect(status().isBadRequest());

        // 3. Replacing with the exact same content is blocked
        MockMultipartFile duplicateReplace = new MockMultipartFile(
                "file", "minutes-v2.pdf", "application/pdf", v1Bytes);
        mvc.perform(multipart("/api/evidence/" + evidenceId + "/replace")
                        .file(duplicateReplace)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .cookie(auth(staff)))
                .andExpect(status().isBadRequest());

        // 4. Replacing with modified content increments to v2 and records version note
        byte[] v2Bytes = "Minutes of Meeting - Revised v2 with signatures".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile v2File = new MockMultipartFile(
                "file", "minutes.pdf", "application/pdf", v2Bytes);

        mvc.perform(multipart("/api/evidence/" + evidenceId + "/replace")
                        .file(v2File)
                        .param("versionNote", "Added dean signature")
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion").value(2))
                .andExpect(jsonPath("$.fileSize").value(v2Bytes.length));

        // Both v1 and v2 remain stored in object storage
        assertThat(fakeBucket).hasSize(2);

        // 5. Uploading a modified file with the same filename in the same activity auto-versions to v3
        byte[] v3Bytes = "Minutes of Meeting - Final v3 approved by VPAA".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile v3File = new MockMultipartFile(
                "files", "minutes.pdf", "application/pdf", v3Bytes);

        mvc.perform(multipart("/api/activities/" + activity.getId() + "/evidence/upload")
                        .file(v3File)
                        .cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(evidenceId.toString()))
                .andExpect(jsonPath("$[0].currentVersion").value(3));

        // Still only 1 Evidence record in the activity, with 3 versions
        mvc.perform(get("/api/activities/" + activity.getId() + "/evidence").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].currentVersion").value(3));

        // 6. List versions returns v3 (current), v2, v1 in descending order
        String versionsBody = mvc.perform(get("/api/evidence/" + evidenceId + "/versions").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].versionNumber").value(3))
                .andExpect(jsonPath("$[0].isCurrent").value(true))
                .andExpect(jsonPath("$[1].versionNumber").value(2))
                .andExpect(jsonPath("$[1].versionNote").value("Added dean signature"))
                .andExpect(jsonPath("$[1].isCurrent").value(false))
                .andExpect(jsonPath("$[2].versionNumber").value(1))
                .andExpect(jsonPath("$[2].isCurrent").value(false))
                .andReturn().getResponse().getContentAsString();

        JsonNode versionsNode = json.readTree(versionsBody);
        String v3VersionId = versionsNode.get(0).get("id").asText();
        String v1VersionId = versionsNode.get(2).get("id").asText();

        // 7. Downloading v1 returns v1's original bytes even though v3 is current
        mvc.perform(get("/api/evidence/" + evidenceId + "/versions/" + v1VersionId + "/download")
                        .cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(content().bytes(v1Bytes));

        // 8. Restoring v1 switches currentVersion back to 1 without creating a duplicate v4 row
        mvc.perform(post("/api/evidence/" + evidenceId + "/versions/" + v1VersionId + "/restore")
                        .cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion").value(1))
                .andExpect(jsonPath("$.fileSize").value(v1Bytes.length));

        mvc.perform(get("/api/evidence/" + evidenceId + "/versions").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].versionNumber").value(3))
                .andExpect(jsonPath("$[0].isCurrent").value(false))
                .andExpect(jsonPath("$[2].versionNumber").value(1))
                .andExpect(jsonPath("$[2].isCurrent").value(true));

        mvc.perform(get("/api/evidence/" + evidenceId + "/download").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(content().bytes(v1Bytes));

        // 9. Deleting non-current version v3 removes it cleanly
        mvc.perform(delete("/api/evidence/" + evidenceId + "/versions/" + v3VersionId)
                        .cookie(auth(staff)))
                .andExpect(status().isOk());

        mvc.perform(get("/api/evidence/" + evidenceId + "/versions").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].versionNumber").value(2))
                .andExpect(jsonPath("$[1].versionNumber").value(1))
                .andExpect(jsonPath("$[1].isCurrent").value(true));
    }

    private Cookie auth(User user) {
        return new Cookie("aercs_token", jwtUtil.generateToken(user));
    }
}

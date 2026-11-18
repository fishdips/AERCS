package com.aercs;

import com.aercs.entity.Activity;
import com.aercs.entity.ActivityType;
import com.aercs.entity.Department;
import com.aercs.entity.Evidence;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceReferenceRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.EvidenceVersionRepository;
import com.aercs.repository.UserNotificationRepository;
import com.aercs.repository.UserRepository;
import com.aercs.security.JwtUtil;
import com.aercs.service.InvitationEmailService;
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
import org.springframework.http.MediaType;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The staff Notifications tab: evidence added to a unit's activities, new versions, and other units
 * referencing a unit's evidence. Everyone in the owning department/office is told, except whoever
 * did it; the reference is the only event that also sends an email.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class UserNotificationsIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private EvidenceRepository evidenceRepository;
    @Autowired private EvidenceVersionRepository versionRepository;
    @Autowired private EvidenceReferenceRepository referenceRepository;
    @Autowired private UserNotificationRepository notificationRepository;

    @MockBean private InvitationEmailService emailService;
    @MockBean private SupabaseStorageService storageService;

    private final Map<String, byte[]> fakeBucket = new ConcurrentHashMap<>();

    private User admin;
    private User chair;      // CCS
    private User staffA;     // CCS
    private User staffB;     // CCS
    private User otherDept;  // CEA
    private User library;    // institutional staff, LIBRARY
    private Activity ccsActivity;
    private Activity ceaActivity;

    @BeforeEach
    void setUp() {
        fakeBucket.clear();
        notificationRepository.deleteAll();
        referenceRepository.deleteAll();
        versionRepository.deleteAll();
        evidenceRepository.deleteAll();
        activityRepository.deleteAll();
        userRepository.deleteAll(userRepository.findAll().stream()
                .filter(u -> u.getRole() != UserRole.ADMIN).toList());

        doAnswer(inv -> {
            fakeBucket.put(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(storageService).upload(anyString(), any(byte[].class), anyString());
        doAnswer(inv -> fakeBucket.get((String) inv.getArgument(0))).when(storageService).download(anyString());

        admin = userRepository.findAll().stream().filter(u -> u.getRole() == UserRole.ADMIN).findFirst()
                .orElseGet(() -> userRepository.save(user("Admin", "unotif-admin@test.local", UserRole.ADMIN, null)));
        chair = userRepository.save(user("Cora Chair", "unotif-chair@test.local", UserRole.ACCRED_COORDINATOR, "CCS"));
        staffA = userRepository.save(user("Sam Staff", "unotif-a@test.local", UserRole.DEPT_STAFF, "CCS"));
        staffB = userRepository.save(user("Bea Staff", "unotif-b@test.local", UserRole.DEPT_STAFF, "CCS"));
        otherDept = userRepository.save(user("Eli Engineer", "unotif-cea@test.local", UserRole.DEPT_STAFF, "CEA"));
        library = userRepository.save(user("Lia Library", "unotif-lib@test.local", UserRole.INSTITUTIONAL_OFFICE, "LIBRARY"));

        ccsActivity = activityRepository.save(activity("Curriculum Review", Department.CCS, staffA));
        ceaActivity = activityRepository.save(activity("Design Studio Visit", Department.CEA, otherDept));
    }

    // ------------------------------------------------------------------ uploads

    @Test
    void everyoneInTheOwningUnitIsToldExceptTheUploader() throws Exception {
        addLink(staffA, ccsActivity, "Minutes");

        JsonNode chairNotices = notifications(chair);
        assertThat(chairNotices.get("unreadCount").asInt()).isEqualTo(1);
        JsonNode notice = chairNotices.get("notifications").get(0);
        assertThat(notice.get("type").asText()).isEqualTo("EVIDENCE_UPLOADED");
        assertThat(notice.get("actorName").asText()).isEqualTo("Sam Staff");
        assertThat(notice.get("activityName").asText()).isEqualTo("Curriculum Review");
        assertThat(notice.get("evidenceName").asText()).isEqualTo("Minutes");
        assertThat(notice.get("count").asInt()).isEqualTo(1);
        assertThat(notice.get("read").asBoolean()).isFalse();

        assertThat(notifications(staffB).get("unreadCount").asInt()).isEqualTo(1);
        // Not the uploader, and not other units.
        assertThat(notifications(staffA).get("notifications")).isEmpty();
        assertThat(notifications(otherDept).get("notifications")).isEmpty();
        assertThat(notifications(library).get("notifications")).isEmpty();
        // Uploading is in-app only.
        verify(emailService, never()).sendEvidenceReferenced(any(), any(), any(), any(), any(), any());
    }

    @Test
    void aBurstOfUploadsFromOnePersonIsFoldedIntoOneNotice() throws Exception {
        MockMultipartFile a = new MockMultipartFile("files", "agenda.pdf", "application/pdf",
                "agenda content".getBytes(StandardCharsets.UTF_8));
        MockMultipartFile b = new MockMultipartFile("files", "roster.pdf", "application/pdf",
                "roster content".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/activities/" + ccsActivity.getId() + "/evidence/upload")
                        .file(a).file(b).cookie(auth(staffA)))
                .andExpect(status().isOk());
        addLink(staffA, ccsActivity, "Photos");

        JsonNode list = notifications(chair).get("notifications");
        assertThat(list).hasSize(1);
        assertThat(list.get(0).get("count").asInt()).isEqualTo(3);
        assertThat(list.get(0).get("evidenceName").asText()).isEqualTo("Photos");
    }

    @Test
    void uploadsByDifferentPeopleOrAfterReadingAreSeparateNotices() throws Exception {
        addLink(staffA, ccsActivity, "Minutes");
        addLink(staffB, ccsActivity, "Attendance");
        assertThat(notifications(chair).get("notifications")).hasSize(2);

        // Once the chairperson has read the first one, the next upload is news again.
        JsonNode first = notifications(chair).get("notifications").get(1);
        mvc.perform(post("/api/notifications/" + first.get("id").asText() + "/read").cookie(auth(chair)))
                .andExpect(status().isNoContent());
        addLink(staffA, ccsActivity, "Photos");
        assertThat(notifications(chair).get("notifications")).hasSize(3);
    }

    @Test
    void anOfficeIsAUnitToo() throws Exception {
        User libraryColleague = userRepository.save(
                user("Leo Library", "unotif-lib2@test.local", UserRole.INSTITUTIONAL_OFFICE, "LIBRARY"));
        Activity libraryActivity = new Activity();
        libraryActivity.setActivityName("Collection Audit");
        libraryActivity.setActivityType(ActivityType.MEETING);
        libraryActivity.setActivityDate(LocalDate.now());
        libraryActivity.setOffice("LIBRARY");
        libraryActivity.setAcademicYear("2026-2027");
        libraryActivity.setCreatedBy(library);
        libraryActivity = activityRepository.save(libraryActivity);

        addLink(library, libraryActivity, "Inventory");

        assertThat(notifications(libraryColleague).get("unreadCount").asInt()).isEqualTo(1);
        assertThat(notifications(library).get("notifications")).isEmpty();
        // Departments are not told about an office's evidence.
        assertThat(notifications(chair).get("notifications")).isEmpty();
        assertThat(notifications(staffA).get("notifications")).isEmpty();
    }

    // ------------------------------------------------------------------ tags

    @Test
    void taggingEvidenceNotifiesTheTaggedUnitsOnlyForNewTags() throws Exception {
        Evidence evidence = addLink(staffA, ccsActivity, "Syllabus");

        tag(staffA, evidence, "COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE", "LIBRARY");

        for (User tagged : new User[]{otherDept, library}) {
            JsonNode notice = firstOfType(tagged, "EVIDENCE_TAGGED");
            assertThat(notice.get("actorName").asText()).isEqualTo("Sam Staff");
            assertThat(notice.get("evidenceName").asText()).isEqualTo("Syllabus");
            assertThat(notice.get("activityName").asText()).isEqualTo("Curriculum Review");
            assertThat(notice.get("evidenceId").asText()).isEqualTo(evidence.getId().toString());
        }
        // The owning unit already knows about its own evidence, and tagging is in-app only.
        assertThat(typesOf(chair)).doesNotContain("EVIDENCE_TAGGED");
        assertThat(typesOf(staffB)).doesNotContain("EVIDENCE_TAGGED");
        verify(emailService, never()).sendEvidenceReferenced(any(), any(), any(), any(), any(), any());

        // Saving the same tags again tells nobody; adding a tag only tells the newly tagged unit.
        mvc.perform(post("/api/notifications/read-all").cookie(auth(otherDept))).andExpect(status().isNoContent());
        mvc.perform(post("/api/notifications/read-all").cookie(auth(library))).andExpect(status().isNoContent());
        tag(staffA, evidence, "COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE", "LIBRARY");
        assertThat(notifications(otherDept).get("unreadCount").asInt()).isZero();
        assertThat(notifications(library).get("unreadCount").asInt()).isZero();
    }

    @Test
    void taggingYourOwnUnitOrYourselfNotifiesNoOne() throws Exception {
        Evidence evidence = addLink(staffA, ccsActivity, "Syllabus");
        notificationRepository.deleteAll();

        tag(staffA, evidence, "COLLEGE_OF_COMPUTER_STUDIES");

        assertThat(typesOf(chair)).isEmpty();
        assertThat(typesOf(staffB)).isEmpty();
        assertThat(typesOf(staffA)).isEmpty();
    }

    @Test
    void taggedEvidenceCanBeOpenedByTheTaggedUnit() throws Exception {
        Evidence evidence = addLink(staffA, ccsActivity, "Syllabus");
        tag(staffA, evidence, "LIBRARY");

        // The notification links to the evidence's references page, which the tagged unit may view.
        mvc.perform(get("/api/evidence/" + evidence.getId() + "/references").cookie(auth(library)))
                .andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ references

    @Test
    void referencingEvidenceNotifiesAndEmailsTheOwningUnit() throws Exception {
        Evidence evidence = shareWithCea(addLink(staffA, ccsActivity, "Syllabus"));

        reference(otherDept, evidence, ceaActivity);

        for (User owner : new User[]{chair, staffB}) {
            JsonNode list = notifications(owner).get("notifications");
            JsonNode notice = list.get(0);
            assertThat(notice.get("type").asText()).isEqualTo("EVIDENCE_REFERENCED");
            assertThat(notice.get("actorName").asText()).isEqualTo("Eli Engineer");
            assertThat(notice.get("activityName").asText()).isEqualTo("Design Studio Visit");
            assertThat(notice.get("evidenceId").asText()).isEqualTo(evidence.getId().toString());
        }
        // The uploader is part of the owning unit and is told too (they did not make the reference).
        assertThat(typesOf(staffA)).contains("EVIDENCE_REFERENCED");
        // Not the person who referenced it.
        assertThat(notifications(otherDept).get("notifications")).isEmpty();

        // One email per recipient; the evidence, the referencing activity and who did it are passed on.
        for (User owner : new User[]{chair, staffA, staffB}) {
            verify(emailService, timeout(3000)).sendEvidenceReferenced(
                    org.mockito.ArgumentMatchers.argThat(u -> u != null && owner.getId().equals(u.getId())),
                    eq("Syllabus"), eq(evidence.getId()), eq("Design Studio Visit"), eq("Eli Engineer"), any());
        }
    }

    @Test
    void removingAReferenceNotifiesInAppOnly() throws Exception {
        Evidence evidence = shareWithCea(addLink(staffA, ccsActivity, "Syllabus"));
        UUID referenceId = reference(otherDept, evidence, ceaActivity);

        mvc.perform(delete("/api/evidence/references/" + referenceId).cookie(auth(otherDept)))
                .andExpect(status().isNoContent());

        assertThat(typesOf(chair)).contains("REFERENCE_REMOVED");
        assertThat(typesOf(staffB)).contains("REFERENCE_REMOVED");
        // Only the one email, from the original reference.
        verify(emailService, timeout(3000).times(3)).sendEvidenceReferenced(any(), any(), any(), any(), any(), any());
    }

    // ------------------------------------------------------------------ versions

    @Test
    void aNewVersionNotifiesTheOwnerAndTheUnitsThatCiteIt() throws Exception {
        MockMultipartFile v1 = new MockMultipartFile("files", "plan.pdf", "application/pdf",
                "plan v1".getBytes(StandardCharsets.UTF_8));
        String body = mvc.perform(multipart("/api/activities/" + ccsActivity.getId() + "/evidence/upload")
                        .file(v1).cookie(auth(staffA)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        UUID evidenceId = UUID.fromString(json.readTree(body).get(0).get("id").asText());
        Evidence evidence = shareWithCea(evidenceRepository.findById(evidenceId).orElseThrow());
        reference(otherDept, evidence, ceaActivity);

        MockMultipartFile v2 = new MockMultipartFile("file", "plan.pdf", "application/pdf",
                "plan v2 with changes".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/evidence/" + evidenceId + "/replace")
                        .file(v2).with(req -> { req.setMethod("PUT"); return req; }).cookie(auth(staffA)))
                .andExpect(status().isOk());

        JsonNode chairNotice = firstOfType(chair, "EVIDENCE_NEW_VERSION");
        assertThat(chairNotice.get("versionNumber").asInt()).isEqualTo(2);
        assertThat(chairNotice.get("evidenceName").asText()).isEqualTo("plan.pdf");
        assertThat(typesOf(otherDept)).contains("EVIDENCE_NEW_VERSION");
        // The person who replaced the file is not told about their own change.
        assertThat(typesOf(staffA)).doesNotContain("EVIDENCE_NEW_VERSION");
    }

    // ------------------------------------------------------------------ reading

    @Test
    void notificationsArePrivateAndCanBeMarkedRead() throws Exception {
        addLink(staffA, ccsActivity, "Minutes");
        addLink(staffB, ccsActivity, "Photos");
        JsonNode chairList = notifications(chair);
        String id = chairList.get("notifications").get(0).get("id").asText();

        // Someone else's notification looks like it does not exist.
        mvc.perform(post("/api/notifications/" + id + "/read").cookie(auth(otherDept)))
                .andExpect(status().isNotFound());

        mvc.perform(post("/api/notifications/" + id + "/read").cookie(auth(chair)))
                .andExpect(status().isNoContent());
        assertThat(notifications(chair).get("unreadCount").asInt()).isEqualTo(1);

        mvc.perform(post("/api/notifications/read-all").cookie(auth(chair)))
                .andExpect(status().isNoContent());
        JsonNode after = notifications(chair);
        assertThat(after.get("unreadCount").asInt()).isZero();
        assertThat(after.get("notifications")).allMatch(n -> n.get("read").asBoolean());
    }

    @Test
    void aNoticeSurvivesTheEvidenceBeingDeleted() throws Exception {
        Evidence evidence = addLink(staffA, ccsActivity, "Minutes");
        assertThat(notifications(chair).get("notifications").get(0).get("evidenceAvailable").asBoolean()).isTrue();

        mvc.perform(delete("/api/evidence/" + evidence.getId()).cookie(auth(staffA)))
                .andExpect(status().isOk());

        JsonNode notice = notifications(chair).get("notifications").get(0);
        assertThat(notice.get("evidenceName").asText()).isEqualTo("Minutes");
        assertThat(notice.get("evidenceAvailable").asBoolean()).isFalse();
        assertThat(notice.get("activityAvailable").asBoolean()).isTrue();
    }

    @Test
    void administratorsAndAccreditorsHaveNoStaffNotificationsTab() throws Exception {
        mvc.perform(get("/api/notifications").cookie(auth(admin))).andExpect(status().isForbidden());
        User accreditor = userRepository.save(user("Acc", "unotif-acc@test.local", UserRole.ACCREDITOR_LINK, null));
        mvc.perform(get("/api/notifications").cookie(auth(accreditor))).andExpect(status().isForbidden());
        mvc.perform(get("/api/notifications")).andExpect(status().is4xxClientError());
    }

    // ------------------------------------------------------------------ helpers

    private Evidence addLink(User by, Activity activity, String title) throws Exception {
        String body = mvc.perform(post("/api/activities/" + activity.getId() + "/evidence/link")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "title", title,
                                "linkUrl", "https://example.com/" + title.replace(' ', '-').toLowerCase())))
                        .cookie(auth(by)))
                .andExpect(status().is2xxSuccessful())
                .andReturn().getResponse().getContentAsString();
        return evidenceRepository.findById(UUID.fromString(json.readTree(body).get("id").asText())).orElseThrow();
    }

    // Tags the evidence for the Engineering college so its staff may see (and so cite) it.
    private Evidence shareWithCea(Evidence evidence) {
        evidence.setRelatedOffices("COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE");
        return evidenceRepository.save(evidence);
    }

    // Saves the evidence's metadata with exactly these "related offices" tagged.
    private void tag(User by, Evidence evidence, String... offices) throws Exception {
        mvc.perform(put("/api/evidence/" + evidence.getId() + "/metadata")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "evidenceType", "REPORT",
                                "relatedOffices", java.util.List.of(offices))))
                        .cookie(auth(by)))
                .andExpect(status().isOk());
    }

    private UUID reference(User by, Evidence evidence, Activity into) throws Exception {
        String body = mvc.perform(post("/api/evidence/" + evidence.getId() + "/references")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("activityId", into.getId().toString())))
                        .cookie(auth(by)))
                .andExpect(status().is2xxSuccessful())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(body).get("id").asText());
    }

    private JsonNode notifications(User user) throws Exception {
        String body = mvc.perform(get("/api/notifications").cookie(auth(user)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    private java.util.List<String> typesOf(User user) throws Exception {
        java.util.List<String> types = new java.util.ArrayList<>();
        notifications(user).get("notifications").forEach(n -> types.add(n.get("type").asText()));
        return types;
    }

    private JsonNode firstOfType(User user, String type) throws Exception {
        for (JsonNode n : notifications(user).get("notifications")) {
            if (type.equals(n.get("type").asText())) return n;
        }
        throw new AssertionError("No " + type + " notification for " + user.getEmail());
    }

    private Cookie auth(User user) {
        return new Cookie("aercs_token", jwtUtil.generateToken(user));
    }

    private static User user(String name, String email, UserRole role, String office) {
        User u = new User();
        u.setName(name);
        u.setEmail(email);
        u.setRole(role);
        u.setOffice(office);
        u.setPasswordHash("unused");
        u.setMustChangePw(false);
        return u;
    }

    private static Activity activity(String name, Department department, User createdBy) {
        Activity a = new Activity();
        a.setActivityName(name);
        a.setActivityType(ActivityType.MEETING);
        a.setActivityDate(LocalDate.now());
        a.setDepartment(department);
        a.setAcademicYear("2026-2027");
        a.setCreatedBy(createdBy);
        return a;
    }
}

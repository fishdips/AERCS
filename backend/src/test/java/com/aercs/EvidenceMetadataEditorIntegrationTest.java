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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * "Last edited by": every save of an evidence record's metadata records who made it and when,
 * so a chairperson overriding what staff entered is traceable.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class EvidenceMetadataEditorIntegrationTest {

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
    private User chair;
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
        doAnswer(inv -> fakeBucket.get((String) inv.getArgument(0))).when(storageService).download(anyString());
        doAnswer(inv -> {
            String path = inv.getArgument(0);
            if (path != null) fakeBucket.remove(path);
            return null;
        }).when(storageService).delete(anyString());

        staff = saveUser("Sam Staff", "editor-staff@test.local", UserRole.DEPT_STAFF);
        chair = saveUser("Cora Chair", "editor-chair@test.local", UserRole.ACCRED_COORDINATOR);

        activity = new Activity();
        activity.setActivityName("Editor Activity");
        activity.setActivityType(ActivityType.MEETING);
        activity.setActivityDate(LocalDate.now());
        activity.setDepartment(Department.CCS);
        activity.setAcademicYear("2026-2027");
        activity.setCreatedBy(staff);
        activity = activityRepository.save(activity);
    }

    @Test
    void metadataThatHasNeverBeenSavedShowsNoEditor() throws Exception {
        UUID id = upload("fresh.pdf", "fresh");

        mvc.perform(get("/api/evidence/" + id + "/metadata").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metadataUpdatedByName").doesNotExist())
                .andExpect(jsonPath("$.metadataUpdatedAt").doesNotExist());
    }

    @Test
    void theStaffMemberWhoSavesItIsRecordedAndThenTheChairpersonWhoOverridesIt() throws Exception {
        UUID id = upload("plan.pdf", "plan");

        saveMetadata(id, staff, "REPORT", "staff note").andExpect(status().isOk());
        JsonNode first = readMetadata(id);
        assertThat(first.get("metadataUpdatedByName").asText()).isEqualTo("Sam Staff");
        assertThat(first.get("metadataUpdatedById").asText()).isEqualTo(staff.getId().toString());
        OffsetDateTime firstAt = OffsetDateTime.parse(first.get("metadataUpdatedAt").asText());

        saveMetadata(id, chair, "MEMORANDUM", "chair note").andExpect(status().isOk())
                // the response to the save already shows who just edited
                .andExpect(jsonPath("$.metadataUpdatedByName").value("Cora Chair"));
        JsonNode second = readMetadata(id);
        assertThat(second.get("metadataUpdatedByName").asText()).isEqualTo("Cora Chair");
        assertThat(second.get("notes").asText()).isEqualTo("chair note");
        assertThat(OffsetDateTime.parse(second.get("metadataUpdatedAt").asText())).isAfterOrEqualTo(firstAt);
    }

    @Test
    void aChairpersonCanOverrideStaffMetadataThroughTheBatchEndpointToo() throws Exception {
        UUID one = upload("one.pdf", "one");
        UUID two = upload("two.pdf", "two");
        saveMetadata(one, staff, "REPORT", "staff note").andExpect(status().isOk());

        mvc.perform(put("/api/evidence/metadata/batch").cookie(auth(chair))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "evidenceIds", List.of(one, two),
                                "evidenceType", "CERTIFICATE",
                                "relatedOffices", List.of(),
                                "tags", List.of("batch"),
                                "notes", "set by the chairperson"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        for (UUID id : List.of(one, two)) {
            JsonNode metadata = readMetadata(id);
            assertThat(metadata.get("evidenceType").asText()).isEqualTo("CERTIFICATE");
            assertThat(metadata.get("notes").asText()).isEqualTo("set by the chairperson");
            assertThat(metadata.get("metadataUpdatedByName").asText()).isEqualTo("Cora Chair");
        }
    }

    @Test
    void replacingTheFileDoesNotCountAsAMetadataEdit() throws Exception {
        UUID id = upload("report.pdf", "version one");
        saveMetadata(id, staff, "REPORT", "staff note").andExpect(status().isOk());

        mvc.perform(multipart("/api/evidence/" + id + "/replace")
                        .file(new MockMultipartFile("file", "report.pdf", "application/pdf",
                                "version two".getBytes(StandardCharsets.UTF_8)))
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .cookie(auth(chair)))
                .andExpect(status().isOk());

        assertThat(readMetadata(id).get("metadataUpdatedByName").asText()).isEqualTo("Sam Staff");
    }

    @Test
    void theEditTimeIsKeptButNoNameIsShownWhenTheEditorsAccountIsRemoved() throws Exception {
        UUID id = upload("kept.pdf", "kept");
        User temporary = saveUser("Temp Chair", "editor-temp@test.local", UserRole.ACCRED_COORDINATOR);
        saveMetadata(id, temporary, "REPORT", "temp note").andExpect(status().isOk());

        userRepository.deleteById(temporary.getId());

        JsonNode metadata = readMetadata(id);
        assertThat(metadata.get("metadataUpdatedAt").isNull()).isFalse();   // the edit and its time remain
        assertThat(metadata.get("metadataUpdatedByName").isNull()).isTrue(); // the removed account's name is gone
    }

    // ------------------------------------------------------------------ helpers

    private User saveUser(String name, String email, UserRole role) {
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setRole(role);
        user.setOffice(Department.CCS.name());
        user.setPasswordHash("unused");
        user.setMustChangePw(false);
        return userRepository.save(user);
    }

    private UUID upload(String fileName, String content) throws Exception {
        String body = mvc.perform(multipart("/api/activities/" + activity.getId() + "/evidence/upload")
                        .file(new MockMultipartFile("files", fileName, "application/pdf",
                                content.getBytes(StandardCharsets.UTF_8)))
                        .cookie(auth(staff)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(body).get(0).get("id").asText());
    }

    private ResultActions saveMetadata(UUID id, User as, String type, String notes) throws Exception {
        return mvc.perform(put("/api/evidence/" + id + "/metadata").cookie(auth(as))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "evidenceType", type,
                        "relatedOffices", List.of(),
                        "tags", List.of(),
                        "notes", notes))));
    }

    private JsonNode readMetadata(UUID id) throws Exception {
        return json.readTree(mvc.perform(get("/api/evidence/" + id + "/metadata").cookie(auth(staff)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private Cookie auth(User user) {
        return new Cookie("aercs_token", jwtUtil.generateToken(user));
    }
}

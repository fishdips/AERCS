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
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class LinkEvidenceFolderValidationIntegrationTest {

    private static final String FOLDER = "https://drive.google.com/drive/folders/1AbCdEfGhIjK";
    private static final String DOCUMENT = "https://drive.google.com/file/d/1AbCdEfGhIjK/view";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private EvidenceRepository evidenceRepository;
    @Autowired private EvidenceVersionRepository evidenceVersionRepository;

    private User staff;
    private Activity activity;

    @BeforeEach
    void setUp() {
        evidenceVersionRepository.deleteAll();
        evidenceRepository.deleteAll();
        activityRepository.deleteAll();
        userRepository.deleteAll(userRepository.findAll().stream()
                .filter(u -> u.getRole() != UserRole.ADMIN).toList());

        staff = new User();
        staff.setName("Link Staff");
        staff.setEmail("link-staff@test.local");
        staff.setRole(UserRole.DEPT_STAFF);
        staff.setOffice(Department.CCS.name());
        staff.setPasswordHash("unused");
        staff.setMustChangePw(false);
        staff = userRepository.save(staff);

        activity = new Activity();
        activity.setActivityName("Link Activity");
        activity.setActivityType(ActivityType.MEETING);
        activity.setActivityDate(LocalDate.now());
        activity.setDepartment(Department.CCS);
        activity.setAcademicYear("2026-2027");
        activity.setCreatedBy(staff);
        activity = activityRepository.save(activity);
    }

    @Test
    void addingAFolderLinkIsRejectedAndNothingIsSaved() throws Exception {
        mvc.perform(post("/api/activities/" + activity.getId() + "/evidence/link")
                        .cookie(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Accreditation folder", FOLDER)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("folder")));

        assertThat(evidenceRepository.count()).isZero();
    }

    @Test
    void addingADocumentLinkStillWorks() throws Exception {
        mvc.perform(post("/api/activities/" + activity.getId() + "/evidence/link")
                        .cookie(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Signed attendance", DOCUMENT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.linkUrl").value(DOCUMENT));
    }

    @Test
    void editingADocumentLinkIntoAFolderLinkIsRejected() throws Exception {
        String created = mvc.perform(post("/api/activities/" + activity.getId() + "/evidence/link")
                        .cookie(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Signed attendance", DOCUMENT)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String evidenceId = json.readTree(created).get("id").asText();

        mvc.perform(put("/api/evidence/" + evidenceId + "/link")
                        .cookie(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Signed attendance", FOLDER)))
                .andExpect(status().isBadRequest());

        // The stored link is unchanged.
        assertThat(evidenceRepository.findAll().get(0).getLinkUrl()).isEqualTo(DOCUMENT);
    }

    private String body(String title, String url) throws Exception {
        return json.writeValueAsString(Map.of("title", title, "linkUrl", url));
    }

    private Cookie auth() {
        return new Cookie("aercs_token", jwtUtil.generateToken(staff));
    }
}

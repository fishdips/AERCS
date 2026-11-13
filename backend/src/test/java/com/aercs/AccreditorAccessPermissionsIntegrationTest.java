package com.aercs;

import com.aercs.entity.Activity;
import com.aercs.entity.ActivityType;
import com.aercs.entity.Department;
import com.aercs.entity.Evidence;
import com.aercs.entity.Office;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.repository.AccreditorAccessRepository;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.UserRepository;
import com.aercs.security.JwtUtil;
import com.aercs.service.InvitationEmailService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Who can generate accreditor access, and what they may share:
 * admins and institutional staff can share anything, a chairperson only her own department's
 * evidence, and department staff cannot generate links at all.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class AccreditorAccessPermissionsIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private EvidenceRepository evidenceRepository;
    @Autowired private AccreditorAccessRepository accessRepository;

    @MockBean private InvitationEmailService invitationEmailService;

    private User admin;
    private User ccsChair;
    private User ceaChair;
    private User institutional;
    private User ccsStaff;
    private User accreditor;
    private Activity ccsActivity;
    private Activity ceaActivity;
    private Evidence ccsEvidence;
    private Evidence ceaEvidence;

    @BeforeEach
    void setUp() {
        accessRepository.deleteAll();
        evidenceRepository.deleteAll();
        activityRepository.deleteAll();
        userRepository.deleteAll(userRepository.findAll().stream()
                .filter(u -> u.getRole() != UserRole.ADMIN).toList());

        admin = userRepository.findAll().stream().filter(u -> u.getRole() == UserRole.ADMIN).findFirst()
                .orElseGet(() -> userRepository.save(user("Admin", "perm-admin@test.local", UserRole.ADMIN, null)));
        ccsChair = userRepository.save(user("CCS Chair", "perm-ccs-chair@test.local", UserRole.ACCRED_COORDINATOR, Department.CCS.name()));
        ceaChair = userRepository.save(user("CEA Chair", "perm-cea-chair@test.local", UserRole.ACCRED_COORDINATOR, Department.CEA.name()));
        institutional = userRepository.save(user("QA Staff", "perm-qa@test.local", UserRole.INSTITUTIONAL_OFFICE, Office.QUALITY_ASSURANCE_OFFICE.name()));
        ccsStaff = userRepository.save(user("CCS Staff", "perm-ccs-staff@test.local", UserRole.DEPT_STAFF, Department.CCS.name()));
        accreditor = userRepository.save(user("An Accreditor", "perm-accreditor@test.local", UserRole.ACCREDITOR_LINK, null));

        ccsActivity = activity("CCS Colloquium", Department.CCS, ccsStaff);
        ceaActivity = activity("CEA Design Review", Department.CEA, ceaChair);
        ccsEvidence = evidence(ccsActivity, "CCS program", ccsStaff);
        ceaEvidence = evidence(ceaActivity, "CEA drawings", ceaChair);
    }

    // The test database is shared with the other test classes; leave no links behind that would
    // block their own clean-up (links reference evidence and users).
    @AfterEach
    void cleanUp() {
        accessRepository.deleteAll();
    }

    // ------------------------------------------------------------------ department staff

    @Test
    void departmentStaffCannotGenerateOrManageLinksButCanStillSeeTheirDepartmentsLinks() throws Exception {
        generate(ccsStaff, Map.of("name", "Staff link", "activityId", ccsActivity.getId().toString(),
                "accreditorIds", List.of(accreditor.getId().toString())))
                .andExpect(status().isForbidden());
        generate(ccsStaff, Map.of("name", "Staff link", "evidenceIds", List.of(ccsEvidence.getId().toString()),
                "accreditorIds", List.of(accreditor.getId().toString())))
                .andExpect(status().isForbidden());
        assertThat(accessRepository.count()).isZero();

        // Choosing accreditors is part of generating, so that list is closed to them too.
        mvc.perform(get("/api/accreditor-access/accreditors").cookie(auth(ccsStaff)))
                .andExpect(status().isForbidden());

        // A chairperson shares; the department's staff can then see (but not change) the link.
        generate(ccsChair, Map.of("name", "CCS link", "activityId", ccsActivity.getId().toString(),
                "accreditorIds", List.of(accreditor.getId().toString())))
                .andExpect(status().isOk());
        mvc.perform(get("/api/accreditor-access").cookie(auth(ccsStaff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].canEdit").value(false));
    }

    // ------------------------------------------------------------------ chairperson

    @Test
    void aChairpersonCanShareHerOwnDepartmentsActivityAndEvidence() throws Exception {
        generate(ccsChair, Map.of("name", "Whole activity", "activityId", ccsActivity.getId().toString(),
                "accreditorIds", List.of(accreditor.getId().toString())))
                .andExpect(status().isOk());
        generate(ccsChair, Map.of("name", "One file", "evidenceIds", List.of(ccsEvidence.getId().toString()),
                "accreditorIds", List.of(accreditor.getId().toString())))
                .andExpect(status().isOk());
        assertThat(accessRepository.count()).isEqualTo(2);
    }

    @Test
    void aChairpersonCannotShareAnotherDepartmentsActivityOrEvidence() throws Exception {
        generate(ccsChair, Map.of("name", "Their activity", "activityId", ceaActivity.getId().toString(),
                "accreditorIds", List.of(accreditor.getId().toString())))
                .andExpect(status().isForbidden());
        generate(ccsChair, Map.of("name", "Their file", "evidenceIds", List.of(ceaEvidence.getId().toString()),
                "accreditorIds", List.of(accreditor.getId().toString())))
                .andExpect(status().isForbidden());
        assertThat(accessRepository.count()).isZero();
    }

    @Test
    void oneForeignFileInTheSelectionRejectsTheWholeLinkAndCreatesNothing() throws Exception {
        generate(ccsChair, Map.of("name", "Mixed",
                "evidenceIds", List.of(ccsEvidence.getId().toString(), ceaEvidence.getId().toString()),
                "accreditorIds", List.of(accreditor.getId().toString())))
                .andExpect(status().isForbidden());
        assertThat(accessRepository.count()).isZero();
    }

    @Test
    void aForeignFileCannotBeSmuggledInAlongsideAnOwnedActivity() throws Exception {
        generate(ccsChair, Map.of("name", "Smuggle",
                "activityId", ccsActivity.getId().toString(),
                "evidenceIds", List.of(ceaEvidence.getId().toString()),
                "accreditorIds", List.of(accreditor.getId().toString())))
                .andExpect(status().isForbidden());
        assertThat(accessRepository.count()).isZero();
    }

    // ------------------------------------------------------------------ admin and institutional staff

    @Test
    void adminsAndInstitutionalStaffCanShareAnyDepartmentsEvidence() throws Exception {
        for (User sharer : List.of(admin, institutional)) {
            // A different accreditor for each sharer: an activity can't be shared twice with the same one.
            User recipient = userRepository.save(user("Accreditor for " + sharer.getRole(),
                    "perm-acc-" + sharer.getRole() + "@test.local", UserRole.ACCREDITOR_LINK, null));
            generate(sharer, Map.of("name", "Any activity " + sharer.getRole(),
                    "activityId", ceaActivity.getId().toString(),
                    "accreditorIds", List.of(recipient.getId().toString())))
                    .andExpect(status().isOk());
            generate(sharer, Map.of("name", "Any file " + sharer.getRole(),
                    "evidenceIds", List.of(ccsEvidence.getId().toString(), ceaEvidence.getId().toString()),
                    "accreditorIds", List.of(recipient.getId().toString())))
                    .andExpect(status().isOk());
        }
        assertThat(accessRepository.count()).isEqualTo(4);
    }

    // ------------------------------------------------------------------ helpers

    private ResultActions generate(User as, Map<String, Object> body) throws Exception {
        return mvc.perform(post("/api/accreditor-access/generate")
                .cookie(auth(as))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)));
    }

    private Activity activity(String name, Department department, User createdBy) {
        Activity a = new Activity();
        a.setActivityName(name);
        a.setActivityType(ActivityType.SEMINAR);
        a.setActivityDate(LocalDate.now());
        a.setDepartment(department);
        a.setAcademicYear("2026-2027");
        a.setCreatedBy(createdBy);
        return activityRepository.save(a);
    }

    private Evidence evidence(Activity activity, String name, User uploadedBy) {
        Evidence e = new Evidence();
        e.setActivity(activity);
        e.setOriginalFileName(name);
        e.setLinkUrl("https://example.com/" + name.replace(' ', '-'));
        e.setFileType("LINK");
        e.setFileSize(0);
        e.setUploadedBy(uploadedBy);
        return evidenceRepository.save(e);
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
}

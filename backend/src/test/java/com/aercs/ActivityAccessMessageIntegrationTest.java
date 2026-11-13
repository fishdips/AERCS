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
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Opening an activity you can't see says "no access" (403), and only an activity that does not
 * exist says "not found" (404). People arrive here from links on lists, where "not found" would
 * read as a broken link.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class ActivityAccessMessageIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private EvidenceRepository evidenceRepository;
    @Autowired private EvidenceVersionRepository evidenceVersionRepository;

    // Same mock as the other evidence tests, so they share one application context.
    @MockBean private SupabaseStorageService storageService;

    private User ccsStaff;
    private User ceaStaff;
    private User ceaChair;
    private User institutional;
    private Activity ccsActivity;

    @BeforeEach
    void setUp() {
        evidenceVersionRepository.deleteAll();
        evidenceRepository.deleteAll();
        activityRepository.deleteAll();
        userRepository.deleteAll(userRepository.findAll().stream()
                .filter(u -> u.getRole() != UserRole.ADMIN).toList());

        ccsStaff = userRepository.save(user("CCS Staff", "access-ccs@test.local", UserRole.DEPT_STAFF, Department.CCS.name()));
        ceaStaff = userRepository.save(user("CEA Staff", "access-cea@test.local", UserRole.DEPT_STAFF, Department.CEA.name()));
        ceaChair = userRepository.save(user("CEA Chair", "access-cea-chair@test.local", UserRole.ACCRED_COORDINATOR, Department.CEA.name()));
        institutional = userRepository.save(user("QA Staff", "access-qa@test.local", UserRole.INSTITUTIONAL_OFFICE, "QUALITY_ASSURANCE_OFFICE"));

        ccsActivity = new Activity();
        ccsActivity.setActivityName("CCS Colloquium");
        ccsActivity.setActivityType(ActivityType.SEMINAR);
        ccsActivity.setActivityDate(LocalDate.now());
        ccsActivity.setDepartment(Department.CCS);
        ccsActivity.setAcademicYear("2026-2027");
        ccsActivity.setCreatedBy(ccsStaff);
        ccsActivity = activityRepository.save(ccsActivity);
    }

    @Test
    void anotherDepartmentsActivitySaysNoAccessRatherThanNotFound() throws Exception {
        for (User outsider : new User[] {ceaStaff, ceaChair}) {
            mvc.perform(get("/api/activities/" + ccsActivity.getId()).cookie(auth(outsider)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error").value("You don't have access to this activity."));
        }
    }

    @Test
    void anActivityThatDoesNotExistStillSaysNotFound() throws Exception {
        mvc.perform(get("/api/activities/" + UUID.randomUUID()).cookie(auth(ceaStaff)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Activity not found"));
    }

    @Test
    void peopleWhoCanSeeTheActivityStillOpenIt() throws Exception {
        User admin = userRepository.findAll().stream().filter(u -> u.getRole() == UserRole.ADMIN).findFirst()
                .orElseGet(() -> userRepository.save(user("Admin", "access-admin@test.local", UserRole.ADMIN, null)));

        for (User viewer : new User[] {ccsStaff, admin, institutional}) {
            mvc.perform(get("/api/activities/" + ccsActivity.getId()).cookie(auth(viewer)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.activityName").value("CCS Colloquium"));
        }
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

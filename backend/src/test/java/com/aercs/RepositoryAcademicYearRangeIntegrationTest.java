package com.aercs;

import com.aercs.entity.Activity;
import com.aercs.entity.ActivityType;
import com.aercs.entity.Department;
import com.aercs.entity.Evidence;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.EvidenceVersionRepository;
import com.aercs.repository.UserRepository;
import com.aercs.security.JwtUtil;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class RepositoryAcademicYearRangeIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private EvidenceRepository evidenceRepository;
    @Autowired private EvidenceVersionRepository evidenceVersionRepository;

    private User staff;

    @BeforeEach
    void setUp() {
        evidenceVersionRepository.deleteAll();
        evidenceRepository.deleteAll();
        activityRepository.deleteAll();
        userRepository.deleteAll(userRepository.findAll().stream()
                .filter(u -> u.getRole() != UserRole.ADMIN).toList());

        staff = new User();
        staff.setName("Range Staff");
        staff.setEmail("range-staff@test.local");
        staff.setRole(UserRole.DEPT_STAFF);
        staff.setOffice(Department.CCS.name());
        staff.setPasswordHash("unused");
        staff.setMustChangePw(false);
        staff = userRepository.save(staff);

        for (String year : new String[] {"2023-2024", "2024-2025", "2025-2026", "2026-2027"}) {
            Activity activity = new Activity();
            activity.setActivityName("Activity " + year);
            activity.setActivityType(ActivityType.MEETING);
            activity.setActivityDate(LocalDate.now());
            activity.setDepartment(Department.CCS);
            activity.setAcademicYear(year);
            activity.setCreatedBy(staff);
            activity = activityRepository.save(activity);

            Evidence evidence = new Evidence();
            evidence.setActivity(activity);
            evidence.setOriginalFileName("Evidence " + year);
            evidence.setLinkUrl("https://example.com/" + year);
            evidence.setFileType("LINK");
            evidence.setFileSize(0);
            evidence.setUploadedBy(staff);
            evidenceRepository.save(evidence);
        }
    }

    @Test
    void noRangeReturnsEveryYear() throws Exception {
        mvc.perform(get("/api/evidence/repository").cookie(auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4));
    }

    @Test
    void fromAndToAreInclusive() throws Exception {
        mvc.perform(get("/api/evidence/repository")
                        .param("academicYearFrom", "2024-2025")
                        .param("academicYearTo", "2025-2026")
                        .cookie(auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void fromAloneMeansThatYearOnward() throws Exception {
        mvc.perform(get("/api/evidence/repository")
                        .param("academicYearFrom", "2025-2026")
                        .cookie(auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void toAloneMeansUpToThatYear() throws Exception {
        mvc.perform(get("/api/evidence/repository")
                        .param("academicYearTo", "2023-2024")
                        .cookie(auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].academicYear").value("2023-2024"));
    }

    @Test
    void sameYearOnBothEndsIsASingleYear() throws Exception {
        mvc.perform(get("/api/evidence/repository")
                        .param("academicYearFrom", "2025-2026")
                        .param("academicYearTo", "2025-2026")
                        .cookie(auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void backwardsRangeIsRejected() throws Exception {
        mvc.perform(get("/api/evidence/repository")
                        .param("academicYearFrom", "2026-2027")
                        .param("academicYearTo", "2023-2024")
                        .cookie(auth()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void malformedYearIsRejected() throws Exception {
        mvc.perform(get("/api/evidence/repository")
                        .param("academicYearFrom", "last year")
                        .cookie(auth()))
                .andExpect(status().isBadRequest());
    }

    private Cookie auth() {
        return new Cookie("aercs_token", jwtUtil.generateToken(staff));
    }
}

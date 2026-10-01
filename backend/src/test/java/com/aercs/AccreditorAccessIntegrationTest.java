package com.aercs;

import com.aercs.entity.Activity;
import com.aercs.entity.ActivityType;
import com.aercs.entity.Department;
import com.aercs.entity.Evidence;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.repository.AccreditorAccessRepository;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.UserRepository;
import com.aercs.security.JwtUtil;
import com.aercs.service.InvitationEmailService;
import com.aercs.service.UserService;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Accreditor accounts see only the links assigned to them and nothing else in AERCS.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class AccreditorAccessIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private EvidenceRepository evidenceRepository;
    @Autowired private AccreditorAccessRepository accessRepository;
    @Autowired private UserService userService;

    @MockBean private InvitationEmailService invitationEmailService;

    private User staff;
    private User accreditorA;
    private User accreditorB;
    private Evidence evidence;

    @BeforeEach
    void setUp() {
        accessRepository.deleteAll();
        evidenceRepository.deleteAll();
        activityRepository.deleteAll();
        userRepository.deleteAll(userRepository.findAll().stream()
                .filter(u -> u.getRole() != UserRole.ADMIN).toList());

        staff = user("Staff Member", "staff@test.local", UserRole.DEPT_STAFF);
        staff.setOffice(Department.CCS.name());
        staff = userRepository.save(staff);
        accreditorA = userRepository.save(user("Accreditor A", "a@accreditor.local", UserRole.ACCREDITOR_LINK));
        accreditorB = userRepository.save(user("Accreditor B", "b@accreditor.local", UserRole.ACCREDITOR_LINK));

        Activity activity = new Activity();
        activity.setActivityName("Research Colloquium");
        activity.setActivityType(ActivityType.SEMINAR);
        activity.setActivityDate(LocalDate.now());
        activity.setDepartment(Department.CCS);
        activity.setAcademicYear("2026-2027");
        activity.setCreatedBy(staff);
        activity = activityRepository.save(activity);

        Evidence e = new Evidence();
        e.setActivity(activity);
        e.setOriginalFileName("Colloquium program");
        e.setLinkUrl("https://example.com/program");
        e.setFileType("LINK");
        e.setFileSize(0);
        e.setUploadedBy(staff);
        evidence = evidenceRepository.save(e);
    }

    @Test
    void assignedAccreditorSeesNamedLinkAndOthersDoNot() throws Exception {
        UUID linkId = createLink("Area VII – Research", List.of(accreditorA.getId()));

        mvc.perform(get("/api/accreditor/links").cookie(auth(accreditorA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Area VII – Research"))
                .andExpect(jsonPath("$[0].sharedBy").value("Staff Member"))
                .andExpect(jsonPath("$[0].evidenceCount").value(1));

        mvc.perform(get("/api/accreditor/links/" + linkId).cookie(auth(accreditorA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidence[0].originalFileName").value("Colloquium program"));

        // Accreditor B was not assigned: empty list, and the link itself looks nonexistent.
        mvc.perform(get("/api/accreditor/links").cookie(auth(accreditorB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/accreditor/links/" + linkId).cookie(auth(accreditorB)))
                .andExpect(status().isNotFound());

        verify(invitationEmailService, times(1))
                .sendAccreditorLinksAssigned(any(User.class), anyList(), anyString());
    }

    @Test
    void accreditorCannotReachStaffApisAndStaffCannotReachAccreditorApis() throws Exception {
        mvc.perform(get("/api/activities").cookie(auth(accreditorA))).andExpect(status().isForbidden());
        mvc.perform(get("/api/dashboard/summary").cookie(auth(accreditorA))).andExpect(status().isForbidden());
        mvc.perform(get("/api/evidence/" + evidence.getId() + "/view").cookie(auth(accreditorA)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/accreditor-access").cookie(auth(accreditorA))).andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/me").cookie(auth(accreditorA))).andExpect(status().isOk());

        mvc.perform(get("/api/accreditor/links").cookie(auth(staff))).andExpect(status().isForbidden());
        mvc.perform(get("/api/accreditor/links")).andExpect(status().isUnauthorized());
    }

    @Test
    void creatingLinkRequiresNameAndAccreditorAccounts() throws Exception {
        mvc.perform(post("/api/accreditor-access/generate").cookie(auth(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "evidenceIds", List.of(evidence.getId()),
                                "accreditorIds", List.of(accreditorA.getId())))))
                .andExpect(status().isBadRequest());

        // A staff account cannot be assigned as an accreditor.
        mvc.perform(post("/api/accreditor-access/generate").cookie(auth(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "name", "Bad link",
                                "evidenceIds", List.of(evidence.getId()),
                                "accreditorIds", List.of(staff.getId())))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void bulkAssignAddsAccreditorsToEveryLinkWithOneEmailEach() throws Exception {
        UUID first = createLink("Area I", List.of(accreditorA.getId()));
        UUID second = createLink("Area II", List.of(accreditorA.getId()));

        mvc.perform(post("/api/accreditor-access/assign").cookie(auth(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "accessIds", List.of(first, second),
                                "accreditorIds", List.of(accreditorA.getId(), accreditorB.getId())))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailFailures.length()").value(0));

        mvc.perform(get("/api/accreditor/links").cookie(auth(accreditorB)))
                .andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/accreditor/links").cookie(auth(accreditorA)))
                .andExpect(jsonPath("$.length()").value(2));

        // Two creation emails to A, then a single bulk email to B only (A was already assigned).
        verify(invitationEmailService, times(3))
                .sendAccreditorLinksAssigned(any(User.class), anyList(), anyString());
        verify(invitationEmailService).sendAccreditorLinksAssigned(
                org.mockito.ArgumentMatchers.argThat(u -> u.getId().equals(accreditorB.getId())),
                org.mockito.ArgumentMatchers.eq(List.of("Area I", "Area II")),
                anyString());
    }

    @Test
    void editReplacesAccreditorsAndRemovedAccreditorLosesAccess() throws Exception {
        UUID linkId = createLink("Area III", List.of(accreditorA.getId()));

        mvc.perform(patch("/api/accreditor-access/" + linkId).cookie(auth(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "name", "Area III – Instruction",
                                "accreditorIds", List.of(accreditorB.getId())))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Area III – Instruction"));

        mvc.perform(get("/api/accreditor/links/" + linkId).cookie(auth(accreditorA)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/accreditor/links/" + linkId).cookie(auth(accreditorB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Area III – Instruction"));
    }

    @Test
    void deletingAnAssignedAccreditorAccountSucceeds() throws Exception {
        createLink("Area IV", List.of(accreditorA.getId(), accreditorB.getId()));
        User admin = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ADMIN).findFirst()
                .orElseGet(() -> userRepository.save(user("Admin", "admin@test.local", UserRole.ADMIN)));

        mvc.perform(delete("/api/admin/users/" + accreditorA.getId()).cookie(auth(admin)))
                .andExpect(status().is2xxSuccessful());

        mvc.perform(get("/api/accreditor-access").cookie(auth(staff)))
                .andExpect(jsonPath("$[0].accreditors.length()").value(1))
                .andExpect(jsonPath("$[0].accreditors[0].name").value("Accreditor B"));
    }

    @Test
    void sameOfficeColleaguesCanSeeALinkButOnlyTheCreatorCanChangeIt() throws Exception {
        UUID linkId = createLink("Area V", List.of(accreditorA.getId()));

        User colleague = user("Colleague", "colleague@test.local", UserRole.DEPT_STAFF);
        colleague.setOffice(Department.CCS.name());
        colleague = userRepository.save(colleague);
        User outsider = user("Outsider", "outsider@test.local", UserRole.DEPT_STAFF);
        outsider.setOffice(Department.CEA.name());
        outsider = userRepository.save(outsider);

        mvc.perform(get("/api/accreditor-access").cookie(auth(colleague)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Area V"))
                .andExpect(jsonPath("$[0].canEdit").value(false));
        mvc.perform(get("/api/accreditor-access").cookie(auth(staff)))
                .andExpect(jsonPath("$[0].canEdit").value(true));
        mvc.perform(get("/api/accreditor-access").cookie(auth(outsider)))
                .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(patch("/api/accreditor-access/" + linkId).cookie(auth(colleague))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Hijacked"))))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/accreditor-access/" + linkId).cookie(auth(colleague)))
                .andExpect(status().isForbidden());
    }

    private UUID createLink(String name, List<UUID> accreditorIds) throws Exception {
        String body = mvc.perform(post("/api/accreditor-access/generate").cookie(auth(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "name", name,
                                "evidenceIds", List.of(evidence.getId()),
                                "accreditorIds", accreditorIds))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(body);
        assertThat(node.get("accreditorCount").asInt()).isEqualTo(accreditorIds.size());
        return UUID.fromString(node.get("id").asText());
    }

    private Cookie auth(User user) {
        return new Cookie("aercs_token", jwtUtil.generateToken(user));
    }

    private static User user(String name, String email, UserRole role) {
        User u = new User();
        u.setName(name);
        u.setEmail(email);
        u.setRole(role);
        u.setPasswordHash("unused");
        u.setMustChangePw(false);
        return u;
    }
}

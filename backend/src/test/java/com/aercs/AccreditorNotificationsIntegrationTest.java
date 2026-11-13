package com.aercs;

import com.aercs.entity.AccreditorAccess;
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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The accreditor's notifications: a link being shared with them, and links expiring within
 * 24 hours and within 4 hours.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class AccreditorNotificationsIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private EvidenceRepository evidenceRepository;
    @Autowired private AccreditorAccessRepository accessRepository;

    @MockBean private InvitationEmailService invitationEmailService;
    @Autowired private MutableClock clock;

    // The application's clock, replaced here so a test can move time forward instead of waiting.
    static class MutableClock extends Clock {
        private volatile Instant now = Instant.now();

        void reset() { now = Instant.now(); }
        void advance(Duration by) { now = now.plus(by); }

        @Override public ZoneId getZone() { return ZoneId.systemDefault(); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @TestConfiguration
    static class TestClockConfig {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock();
        }
    }

    private User chair;
    private User staff;
    private User accreditorA;
    private User accreditorB;
    private Activity activity;
    private Evidence evidence;

    @BeforeEach
    void setUp() {
        clock.reset();
        accessRepository.deleteAll();
        evidenceRepository.deleteAll();
        activityRepository.deleteAll();
        userRepository.deleteAll(userRepository.findAll().stream()
                .filter(u -> u.getRole() != UserRole.ADMIN).toList());

        chair = userRepository.save(user("Cora Chair", "notif-chair@test.local", UserRole.ACCRED_COORDINATOR, Department.CCS.name()));
        staff = userRepository.save(user("Sam Staff", "notif-staff@test.local", UserRole.DEPT_STAFF, Department.CCS.name()));
        accreditorA = userRepository.save(user("Accreditor A", "notif-a@test.local", UserRole.ACCREDITOR_LINK, null));
        accreditorB = userRepository.save(user("Accreditor B", "notif-b@test.local", UserRole.ACCREDITOR_LINK, null));

        activity = new Activity();
        activity.setActivityName("Research Colloquium");
        activity.setActivityType(ActivityType.SEMINAR);
        activity.setActivityDate(LocalDate.now());
        activity.setDepartment(Department.CCS);
        activity.setAcademicYear("2026-2027");
        activity.setCreatedBy(staff);
        activity = activityRepository.save(activity);

        evidence = new Evidence();
        evidence.setActivity(activity);
        evidence.setOriginalFileName("Program");
        evidence.setLinkUrl("https://example.com/program");
        evidence.setFileType("LINK");
        evidence.setFileSize(0);
        evidence.setUploadedBy(staff);
        evidence = evidenceRepository.save(evidence);
    }

    // The test database is shared with the other test classes; leave nothing behind.
    @AfterEach
    void cleanUp() {
        accessRepository.deleteAll();
    }

    // ------------------------------------------------------------------ shared

    @Test
    void sharingALinkNotifiesEachAccreditorItWasSharedWithAndNoOneElse() throws Exception {
        UUID linkId = shareActivity("Area VII", List.of(accreditorA.getId()), OffsetDateTime.now().plusDays(7));

        JsonNode mine = notificationsOf(accreditorA);
        assertThat(mine.get("unreadCount").asInt()).isEqualTo(1);
        JsonNode notice = mine.get("notifications").get(0);
        assertThat(notice.get("type").asText()).isEqualTo("SHARED");
        assertThat(notice.get("linkId").asText()).isEqualTo(linkId.toString());
        assertThat(notice.get("linkName").asText()).isEqualTo("Area VII");
        assertThat(notice.get("activityName").asText()).isEqualTo("Research Colloquium");
        assertThat(notice.get("sharedByName").asText()).isEqualTo("Cora Chair");
        assertThat(notice.get("read").asBoolean()).isFalse();

        assertThat(notificationsOf(accreditorB).get("notifications")).isEmpty();
    }

    @Test
    void addingAnAccreditorToAnExistingLinkNotifiesOnlyTheNewOne() throws Exception {
        UUID linkId = share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusDays(7));
        markAllRead(accreditorA);

        mvc.perform(patch("/api/accreditor-access/" + linkId).cookie(auth(chair))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "accreditorIds", List.of(accreditorA.getId(), accreditorB.getId())))))
                .andExpect(status().isOk());

        assertThat(notificationsOf(accreditorB).get("unreadCount").asInt()).isEqualTo(1);
        // A was already on the link, so there is nothing new for A.
        assertThat(notificationsOf(accreditorA).get("unreadCount").asInt()).isZero();
    }

    @Test
    void bulkAssigningNotifiesOnlyAccreditorsNewToEachLink() throws Exception {
        UUID first = share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusDays(7));
        UUID second = share("Area II", List.of(accreditorA.getId()), OffsetDateTime.now().plusDays(7));
        markAllRead(accreditorA);

        mvc.perform(post("/api/accreditor-access/assign").cookie(auth(chair))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "accessIds", List.of(first, second),
                                "accreditorIds", List.of(accreditorA.getId(), accreditorB.getId())))))
                .andExpect(status().isOk());

        assertThat(notificationsOf(accreditorB).get("notifications")).hasSize(2);
        assertThat(notificationsOf(accreditorA).get("unreadCount").asInt()).isZero();
    }

    @Test
    void sharingTheSameLinkAgainAfterRemovingAnAccreditorRenewsTheirNoticeInsteadOfDuplicatingIt() throws Exception {
        UUID linkId = share("Area I", List.of(accreditorA.getId(), accreditorB.getId()), OffsetDateTime.now().plusDays(7));
        markAllRead(accreditorA);

        // A is removed (and so sees nothing), then added back.
        setAccreditors(linkId, List.of(accreditorB.getId()));
        assertThat(notificationsOf(accreditorA).get("notifications")).isEmpty();
        setAccreditors(linkId, List.of(accreditorA.getId(), accreditorB.getId()));

        JsonNode again = notificationsOf(accreditorA);
        assertThat(again.get("notifications")).hasSize(1);
        assertThat(again.get("unreadCount").asInt()).isEqualTo(1); // new again, not left as "read"
    }

    // ------------------------------------------------------------------ expiring

    @Test
    void aLinkWithinAdayOfExpiringProducesOneWarningHoweverOftenThePageIsLoaded() throws Exception {
        share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusHours(20));

        for (int load = 0; load < 3; load++) {
            JsonNode list = notificationsOf(accreditorA);
            assertThat(types(list)).containsExactlyInAnyOrder("SHARED", "EXPIRING_24H");
        }
    }

    @Test
    void insideFourHoursTheFinalWarningAppears() throws Exception {
        share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusHours(3));

        JsonNode list = notificationsOf(accreditorA);
        assertThat(types(list)).containsExactlyInAnyOrder("SHARED", "EXPIRING_4H");
        assertThat(types(list)).doesNotContain("EXPIRING_24H"); // the 4-hour one replaces the 24-hour one
    }

    @Test
    void aLinkWarnedAboutAtADayIsWarnedAgainAtFourHoursAndBothStayListed() throws Exception {
        share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusHours(20));
        assertThat(types(notificationsOf(accreditorA))).containsExactlyInAnyOrder("SHARED", "EXPIRING_24H");

        clock.advance(Duration.ofHours(17)); // 3 hours left

        JsonNode list = notificationsOf(accreditorA);
        assertThat(types(list)).containsExactlyInAnyOrder("SHARED", "EXPIRING_24H", "EXPIRING_4H");
        assertThat(types(list).get(0)).isEqualTo("EXPIRING_4H"); // newest first
        assertThat(list.get("unreadCount").asInt()).isEqualTo(3);
    }

    @Test
    void onceALinkHasExpiredNoNewWarningsAppearButTheOldOnesStayListed() throws Exception {
        share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusHours(3));
        assertThat(types(notificationsOf(accreditorA))).containsExactlyInAnyOrder("SHARED", "EXPIRING_4H");

        clock.advance(Duration.ofHours(5)); // now expired

        assertThat(types(notificationsOf(accreditorA))).containsExactlyInAnyOrder("SHARED", "EXPIRING_4H");
    }

    @Test
    void theFinalWarningIsOnlyCreatedOnceEvenWhenThePageIsLoadedRepeatedlyThroughTheLastHours() throws Exception {
        share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusHours(5));

        for (int hour = 0; hour < 5; hour++) {
            notificationsOf(accreditorA);
            clock.advance(Duration.ofMinutes(50));
        }

        assertThat(types(notificationsOf(accreditorA)))
                .containsExactlyInAnyOrder("SHARED", "EXPIRING_24H", "EXPIRING_4H");
    }

    @Test
    void noWarningIsMadeForLinksMoreThanADayAwayOrAlreadyExpired() throws Exception {
        UUID farAway = share("Far away", List.of(accreditorA.getId()), OffsetDateTime.now().plusHours(30));
        assertThat(types(notificationsOf(accreditorA))).containsExactly("SHARED");

        setExpiry(farAway, OffsetDateTime.now().minusHours(1)); // already expired
        assertThat(types(notificationsOf(accreditorA))).containsExactly("SHARED");
    }

    @Test
    void extendingALinkHidesTheWarningThatNoLongerApplies() throws Exception {
        UUID linkId = share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusHours(20));
        assertThat(types(notificationsOf(accreditorA))).contains("EXPIRING_24H");

        mvc.perform(patch("/api/accreditor-access/" + linkId).cookie(auth(chair))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("expiresAt", OffsetDateTime.now().plusDays(10).toString()))))
                .andExpect(status().isOk());

        JsonNode list = notificationsOf(accreditorA);
        assertThat(types(list)).containsExactly("SHARED");
        assertThat(list.get("unreadCount").asInt()).isEqualTo(1); // the stale warning is not counted either
    }

    @Test
    void anAccreditorTakenOffALinkNoLongerSeesItsNotices() throws Exception {
        UUID linkId = share("Area I", List.of(accreditorA.getId(), accreditorB.getId()), OffsetDateTime.now().plusHours(20));
        assertThat(notificationsOf(accreditorA).get("notifications")).isNotEmpty();

        setAccreditors(linkId, List.of(accreditorB.getId()));

        assertThat(notificationsOf(accreditorA).get("notifications")).isEmpty();
        assertThat(notificationsOf(accreditorB).get("notifications")).isNotEmpty();
    }

    // ------------------------------------------------------------------ read state

    @Test
    void markingNoticesReadUpdatesTheUnreadCount() throws Exception {
        share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusHours(20));
        share("Area II", List.of(accreditorA.getId()), OffsetDateTime.now().plusDays(7));
        JsonNode before = notificationsOf(accreditorA);
        assertThat(before.get("unreadCount").asInt()).isEqualTo(3);

        String firstId = before.get("notifications").get(0).get("id").asText();
        mvc.perform(post("/api/accreditor/notifications/" + firstId + "/read").cookie(auth(accreditorA)))
                .andExpect(status().isNoContent());
        assertThat(notificationsOf(accreditorA).get("unreadCount").asInt()).isEqualTo(2);

        markAllRead(accreditorA);
        JsonNode after = notificationsOf(accreditorA);
        assertThat(after.get("unreadCount").asInt()).isZero();
        assertThat(after.get("notifications")).hasSize(3); // read notices stay listed
    }

    @Test
    void anAccreditorCannotMarkSomeoneElsesNoticeRead() throws Exception {
        share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusDays(7));
        String aNotice = notificationsOf(accreditorA).get("notifications").get(0).get("id").asText();

        mvc.perform(post("/api/accreditor/notifications/" + aNotice + "/read").cookie(auth(accreditorB)))
                .andExpect(status().isNotFound());
        assertThat(notificationsOf(accreditorA).get("unreadCount").asInt()).isEqualTo(1);
    }

    // ------------------------------------------------------------------ housekeeping and access

    @Test
    void deletingALinkRemovesItsNotices() throws Exception {
        UUID linkId = share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusHours(20));
        assertThat(notificationsOf(accreditorA).get("notifications")).isNotEmpty();

        mvc.perform(delete("/api/accreditor-access/" + linkId).cookie(auth(chair)))
                .andExpect(status().isNoContent());

        assertThat(notificationsOf(accreditorA).get("notifications")).isEmpty();
    }

    @Test
    void accreditorSessionsStayReadOnlyApartFromMarkingNoticesRead() throws Exception {
        UUID linkId = share("Area I", List.of(accreditorA.getId()), OffsetDateTime.now().plusDays(7));
        String noticeId = notificationsOf(accreditorA).get("notifications").get(0).get("id").asText();

        // The two read-state endpoints work...
        mvc.perform(post("/api/accreditor/notifications/" + noticeId + "/read").cookie(auth(accreditorA)))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/accreditor/notifications/read-all").cookie(auth(accreditorA)))
                .andExpect(status().isNoContent());

        // ...but nothing else under /api/accreditor is open to writing.
        mvc.perform(delete("/api/accreditor/notifications/" + noticeId).cookie(auth(accreditorA)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/accreditor/notifications").cookie(auth(accreditorA)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/accreditor/notifications/" + noticeId + "/delete").cookie(auth(accreditorA)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/accreditor/links/" + linkId).cookie(auth(accreditorA)))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/accreditor/links/" + linkId).cookie(auth(accreditorA)))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/accreditor/links/" + linkId).cookie(auth(accreditorA)))
                .andExpect(status().isForbidden());
    }

    @Test
    void onlyAccreditorsCanReadNotifications() throws Exception {
        mvc.perform(get("/api/accreditor/notifications").cookie(auth(staff))).andExpect(status().isForbidden());
        mvc.perform(get("/api/accreditor/notifications").cookie(auth(chair))).andExpect(status().isForbidden());
        mvc.perform(get("/api/accreditor/notifications")).andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------ helpers

    // Shared by evidence, so the same accreditor can be given several links (an activity can only
    // be shared once with each accreditor).
    private UUID share(String name, List<UUID> accreditorIds, OffsetDateTime expiresAt) throws Exception {
        return generate(Map.of(
                "name", name,
                "evidenceIds", List.of(evidence.getId()),
                "accreditorIds", accreditorIds,
                "expirationDateTime", expiresAt.toString()));
    }

    private UUID shareActivity(String name, List<UUID> accreditorIds, OffsetDateTime expiresAt) throws Exception {
        return generate(Map.of(
                "name", name,
                "activityId", activity.getId(),
                "accreditorIds", accreditorIds,
                "expirationDateTime", expiresAt.toString()));
    }

    private UUID generate(Map<String, Object> request) throws Exception {
        String body = mvc.perform(post("/api/accreditor-access/generate").cookie(auth(chair))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(body).get("id").asText());
    }

    private void setAccreditors(UUID linkId, List<UUID> accreditorIds) throws Exception {
        mvc.perform(patch("/api/accreditor-access/" + linkId).cookie(auth(chair))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("accreditorIds", accreditorIds))))
                .andExpect(status().isOk());
    }

    // Simulates time passing by moving the link's expiry directly.
    private void setExpiry(UUID linkId, OffsetDateTime expiresAt) {
        AccreditorAccess link = accessRepository.findById(linkId).orElseThrow();
        link.setExpiresAt(expiresAt);
        accessRepository.saveAndFlush(link);
    }

    private JsonNode notificationsOf(User accreditor) throws Exception {
        return json.readTree(mvc.perform(get("/api/accreditor/notifications").cookie(auth(accreditor)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private void markAllRead(User accreditor) throws Exception {
        mvc.perform(post("/api/accreditor/notifications/read-all").cookie(auth(accreditor)))
                .andExpect(status().isNoContent());
    }

    private static List<String> types(JsonNode list) {
        List<String> types = new ArrayList<>();
        list.get("notifications").forEach(n -> types.add(n.get("type").asText()));
        return types;
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

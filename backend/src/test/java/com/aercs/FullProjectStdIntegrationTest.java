package com.aercs;

import com.aercs.entity.*;
import com.aercs.repository.*;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

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
import static org.mockito.Mockito.doNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class FullProjectStdIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private UserRepository userRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private EvidenceRepository evidenceRepository;
    @Autowired private EvidenceVersionRepository evidenceVersionRepository;
    @Autowired private EvidenceReferenceRepository evidenceReferenceRepository;
    @Autowired private AccreditorAccessRepository accreditorAccessRepository;

    @MockBean private SupabaseStorageService storageService;
    @MockBean private InvitationEmailService invitationEmailService;

    private final Map<String, byte[]> fakeBucket = new ConcurrentHashMap<>();

    private User adm;
    private User cha;
    private User chb;
    private User sta;
    private User stb;
    private User ios;
    private User acc1;
    private User acc2;
    private User noDeptUser;

    @BeforeEach
    void setUp() {
        fakeBucket.clear();
        accreditorAccessRepository.deleteAll();
        evidenceReferenceRepository.deleteAll();
        evidenceVersionRepository.deleteAll();
        evidenceRepository.deleteAll();
        activityRepository.deleteAll();
        userRepository.deleteAll();

        doAnswer(inv -> {
            String path = inv.getArgument(0);
            byte[] bytes = inv.getArgument(1);
            fakeBucket.put(path, bytes);
            return null;
        }).when(storageService).upload(anyString(), any(byte[].class), anyString());

        doAnswer(inv -> {
            String path = inv.getArgument(0);
            return fakeBucket.getOrDefault(path, new byte[0]);
        }).when(storageService).download(anyString());

        doAnswer(inv -> {
            String path = inv.getArgument(0);
            if (path != null) fakeBucket.remove(path);
            return null;
        }).when(storageService).delete(anyString());

        doNothing().when(invitationEmailService).sendInvitation(any(), anyString());
        doNothing().when(invitationEmailService).sendAdminPasswordReset(any(), anyString());
        doNothing().when(invitationEmailService).sendAccreditorLinksAssigned(any(), any(), anyString());

        adm = createTestUser("System Admin", "tu-admin@cit.edu", UserRole.ADMIN, Department.CCS.name());
        cha = createTestUser("CCS Chair", "tu-chair-ccs@cit.edu", UserRole.ACCRED_COORDINATOR, Department.CCS.name());
        chb = createTestUser("CEA Chair", "tu-chair-cea@cit.edu", UserRole.ACCRED_COORDINATOR, Department.CEA.name());
        sta = createTestUser("CCS Staff", "tu-staff-ccs@cit.edu", UserRole.DEPT_STAFF, Department.CCS.name());
        stb = createTestUser("CEA Staff", "tu-staff-cea@cit.edu", UserRole.DEPT_STAFF, Department.CEA.name());
        ios = createTestUser("QA Staff", "tu-inst-qao@cit.edu", UserRole.INSTITUTIONAL_OFFICE, Office.QUALITY_ASSURANCE_OFFICE.name());
        acc1 = createTestUser("Accreditor One", "tu-accreditor-1@cit.edu", UserRole.ACCREDITOR_LINK, Department.CCS.name());
        acc2 = createTestUser("Accreditor Two", "tu-accreditor-2@cit.edu", UserRole.ACCREDITOR_LINK, Department.CCS.name());
        noDeptUser = createTestUser("No Dept Staff", "tu-nodept@cit.edu", UserRole.DEPT_STAFF, null);
    }

    private User createTestUser(String name, String email, UserRole role, String office) {
        User u = new User();
        u.setName(name);
        u.setEmail(email);
        u.setRole(role);
        u.setOffice(office);
        u.setPasswordHash(passwordEncoder.encode("TestPass123!"));
        u.setActive(true);
        u.setMustChangePw(false);
        return userRepository.save(u);
    }

    private Cookie auth(User user) {
        return new Cookie("aercs_token", jwtUtil.generateToken(user));
    }

    // =========================================================================
    // CASE 1: Create Activity (M1-UC1, TC-M1-UC1-01 .. TC-M1-UC1-10)
    // =========================================================================
    @Test
    void case01_createActivity_M1_UC1() throws Exception {
        // TC-M1-UC1-01: Department Staff creates activity with valid details
        mvc.perform(post("/api/activities")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", "CCS Faculty Development Seminar 2026",
                                "description", "Annual seminar on outcome-based education",
                                "activityType", "SEMINAR",
                                "activityDate", LocalDate.now().minusDays(5).toString(),
                                "accreditationArea", "FACULTY",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.activityName").value("CCS Faculty Development Seminar 2026"))
                .andExpect(jsonPath("$.department").value("CCS"));

        // TC-M1-UC1-02: Chairperson creates activity with OTHER + customActivityType
        mvc.perform(post("/api/activities")
                        .cookie(auth(cha))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", "CCS Industry Advisory Board Consultation",
                                "activityType", "OTHER",
                                "customActivityType", "Advisory Consultation",
                                "activityDate", LocalDate.now().minusDays(2).toString(),
                                "accreditationArea", "INSTRUCTION",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customActivityType").value("Advisory Consultation"));

        // OTHER without customActivityType -> 400
        mvc.perform(post("/api/activities")
                        .cookie(auth(cha))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", "Missing Custom Type",
                                "activityType", "OTHER",
                                "activityDate", LocalDate.now().toString(),
                                "accreditationArea", "FACULTY",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isBadRequest());

        // TC-M1-UC1-03: Institutional Office Staff creates activity
        mvc.perform(post("/api/activities")
                        .cookie(auth(ios))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", "University-wide QA Orientation 2026",
                                "activityType", "WORKSHOP",
                                "activityDate", LocalDate.now().minusDays(1).toString(),
                                "accreditationArea", "ADMINISTRATION",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.office").value("QUALITY_ASSURANCE_OFFICE"));

        // TC-M1-UC1-04 & 05: Title required and max 150 chars boundary
        String title150 = "A".repeat(150);
        String title151 = "A".repeat(151);

        mvc.perform(post("/api/activities")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", "   ",
                                "activityType", "MEETING",
                                "activityDate", LocalDate.now().toString(),
                                "accreditationArea", "FACULTY",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/activities")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", title150,
                                "activityType", "MEETING",
                                "activityDate", LocalDate.now().toString(),
                                "accreditationArea", "FACULTY",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/activities")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", title151,
                                "activityType", "MEETING",
                                "activityDate", LocalDate.now().toString(),
                                "accreditationArea", "FACULTY",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isBadRequest());

        // TC-M1-UC1-07: Future activity date rejected
        mvc.perform(post("/api/activities")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", "Future Activity",
                                "activityType", "MEETING",
                                "activityDate", LocalDate.now().plusDays(1).toString(),
                                "accreditationArea", "FACULTY",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.activityDate").value("Activity date cannot be in the future"));

        // TC-M1-UC1-08: User without assigned department or office rejected
        mvc.perform(post("/api/activities")
                        .cookie(auth(noDeptUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", "Unassigned Dept Activity",
                                "activityType", "MEETING",
                                "activityDate", LocalDate.now().toString(),
                                "accreditationArea", "FACULTY",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isBadRequest());

        // TC-M1-UC1-09: System Administrator cannot create activities
        mvc.perform(post("/api/activities")
                        .cookie(auth(adm))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", "Admin Activity",
                                "activityType", "MEETING",
                                "activityDate", LocalDate.now().toString(),
                                "accreditationArea", "FACULTY",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isForbidden());
    }

    // =========================================================================
    // CASE 2: Upload Evidence to Activity (M1-UC2, TC-M1-UC2-01..15 & INC-07)
    // =========================================================================
    @Test
    void case02_uploadEvidenceAndLinks_M1_UC2_and_INC07() throws Exception {
        Activity act1 = saveActivity("ACT-1 CCS Seminar", Department.CCS, null, sta, AccreditationArea.FACULTY);
        Activity act2 = saveActivity("ACT-2 CCS Workshop", Department.CCS, null, sta, AccreditationArea.INSTRUCTION);

        byte[] pdfBytes = "%PDF-1.4 sample evidence content".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile validPdf = new MockMultipartFile("files", "seminar-attendance.pdf", "application/pdf", pdfBytes);

        // TC-M1-UC2-01: Single valid PDF upload
        mvc.perform(multipart("/api/activities/" + act1.getId() + "/evidence/upload")
                        .file(validPdf)
                        .cookie(auth(sta)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].originalFileName").value("seminar-attendance.pdf"))
                .andExpect(jsonPath("$[0].fileType").value("PDF"))
                .andExpect(jsonPath("$[0].currentVersion").value(1));

        // TC-M1-UC2-02: Batch upload of DOCX, XLSX, JPG, PNG
        MockMultipartFile docx = new MockMultipartFile("files", "report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx-bytes".getBytes());
        MockMultipartFile xlsx = new MockMultipartFile("files", "matrix.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx-bytes".getBytes());
        MockMultipartFile jpg = new MockMultipartFile("files", "photo.jpg", "image/jpeg", "jpg-bytes".getBytes());
        MockMultipartFile png = new MockMultipartFile("files", "poster.png", "image/png", "png-bytes".getBytes());

        mvc.perform(multipart("/api/activities/" + act1.getId() + "/evidence/upload")
                        .file(docx).file(xlsx).file(jpg).file(png)
                        .cookie(auth(sta)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4));

        // TC-M1-UC2-05: Add Google Drive / Web link
        mvc.perform(post("/api/activities/" + act1.getId() + "/evidence/link")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "title", "CCS Accreditation Drive Folder",
                                "linkUrl", "https://drive.google.com/drive/folders/123456"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fileType").value("LINK"));

        // TC-M1-UC2-06: Unsupported file type (.txt / .exe) rejected
        MockMultipartFile badTxt = new MockMultipartFile("files", "notes.txt", "text/plain", "hello".getBytes());
        mvc.perform(multipart("/api/activities/" + act1.getId() + "/evidence/upload")
                        .file(badTxt)
                        .cookie(auth(sta)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Unsupported file type. Allowed types: PDF, DOCX, XLSX, JPG, JPEG, PNG"));

        // TC-M1-UC2-07: File > 10 MB rejected
        byte[] over10Mb = new byte[10 * 1024 * 1024 + 10];
        MockMultipartFile hugePdf = new MockMultipartFile("files", "huge.pdf", "application/pdf", over10Mb);
        mvc.perform(multipart("/api/activities/" + act1.getId() + "/evidence/upload")
                        .file(hugePdf)
                        .cookie(auth(sta)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Evidence file must not exceed 10 MB"));

        // TC-M1-UC2-08: Invalid link URL rejected
        mvc.perform(post("/api/activities/" + act1.getId() + "/evidence/link")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "title", "Bad Link",
                                "linkUrl", "ftp://files.example.com/doc.pdf"
                        ))))
                .andExpect(status().isBadRequest());

        // TC-M1-UC2-09..13: Cross-activity duplicate returns duplicateWarning
        mvc.perform(multipart("/api/activities/" + act2.getId() + "/evidence/upload")
                        .file(validPdf)
                        .cookie(auth(sta)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].duplicateWarning.activityId").value(act1.getId().toString()));

        // TC-M1-UC2-14 (INC-07): Staff of another department (STB, CEA) cannot upload or add links to CCS activity
        mvc.perform(multipart("/api/activities/" + act1.getId() + "/evidence/upload")
                        .file(new MockMultipartFile("files", "cea.pdf", "application/pdf", "cea-content".getBytes()))
                        .cookie(auth(stb)))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/activities/" + act1.getId() + "/evidence/link")
                        .cookie(auth(stb))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "title", "CEA Link",
                                "linkUrl", "https://drive.google.com/drive/folders/cea"
                        ))))
                .andExpect(status().isForbidden());

        // TC-M1-UC2-15: System Administrator cannot upload evidence
        mvc.perform(multipart("/api/activities/" + act1.getId() + "/evidence/upload")
                        .file(new MockMultipartFile("files", "admin.pdf", "application/pdf", "admin-content".getBytes()))
                        .cookie(auth(adm)))
                .andExpect(status().isForbidden());
    }

    // =========================================================================
    // CASE 3: Assign Evidence Details / Metadata (M1-UC3, TC-M1-UC3-01..08 & INC-06)
    // =========================================================================
    @Test
    void case03_assignMetadata_M1_UC3_and_INC06() throws Exception {
        Activity act1 = saveActivity("ACT-1 CCS Seminar", Department.CCS, null, sta, AccreditationArea.FACULTY);
        UUID ev1 = uploadSamplePdf(act1, sta, "ev1.pdf", "ev1-bytes");
        UUID ev2 = uploadSamplePdf(act1, sta, "ev2.pdf", "ev2-bytes");

        // TC-M1-UC3-01: Uploader saves single metadata
        mvc.perform(put("/api/evidence/" + ev1 + "/metadata")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "evidenceType", "ATTENDANCE_SHEET",
                                "relatedOffices", List.of("COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE", "QUALITY_ASSURANCE_OFFICE"),
                                "tags", List.of("seminar", "faculty", "2026"),
                                "notes", "Signed attendance sheet for the faculty seminar."
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidenceType").value("ATTENDANCE_SHEET"))
                .andExpect(jsonPath("$.tags.length()").value(3));

        // TC-M1-UC3-02: Batch metadata assignment
        mvc.perform(put("/api/evidence/metadata/batch")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "evidenceIds", List.of(ev1.toString(), ev2.toString()),
                                "evidenceType", "REPORT",
                                "relatedOffices", List.of("QUALITY_ASSURANCE_OFFICE"),
                                "tags", List.of("batch-tag"),
                                "notes", "Batch updated notes"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        // TC-M1-UC3-04 & 05: Validation on missing evidenceType, tag > 50 chars, notes > 1000 chars
        mvc.perform(put("/api/evidence/" + ev1 + "/metadata")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tags\":[\"valid\"]}"))
                .andExpect(status().isBadRequest());

        mvc.perform(put("/api/evidence/" + ev1 + "/metadata")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "evidenceType", "REPORT",
                                "tags", List.of("T".repeat(50)),
                                "notes", "N".repeat(1000)
                        ))))
                .andExpect(status().isOk());

        mvc.perform(put("/api/evidence/" + ev1 + "/metadata")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "evidenceType", "REPORT",
                                "tags", List.of("T".repeat(51))
                        ))))
                .andExpect(status().isBadRequest());

        // TC-M1-UC3-06: Department Staff who is not the uploader (STB) refused -> 403
        mvc.perform(put("/api/evidence/" + ev1 + "/metadata")
                        .cookie(auth(stb))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("evidenceType", "OTHER"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Only the uploader can modify this evidence"));

        // TC-M1-UC3-07 (INC-06): Chairperson of another department (CHB, CEA) refused -> 403
        mvc.perform(put("/api/evidence/" + ev1 + "/metadata")
                        .cookie(auth(chb))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("evidenceType", "OTHER"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Chairperson can only modify evidence within their department"));

        // Same-department Chairperson (CHA, CCS) allowed -> 200 OK
        mvc.perform(put("/api/evidence/" + ev1 + "/metadata")
                        .cookie(auth(cha))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("evidenceType", "CERTIFICATE", "notes", "Approved by Chair"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidenceType").value("CERTIFICATE"));

        // TC-M1-UC3-08: System Administrator (ADM) allowed -> 200 OK
        mvc.perform(put("/api/evidence/" + ev1 + "/metadata")
                        .cookie(auth(adm))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("evidenceType", "MEMORANDUM", "notes", "Updated by Admin"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidenceType").value("MEMORANDUM"));
    }

    // =========================================================================
    // CASE 4: Edit, Replace, and Delete Activity and Evidence (M1-UC4)
    // =========================================================================
    @Test
    void case04_editReplaceDeleteActivityAndEvidence_M1_UC4() throws Exception {
        Activity act1 = saveActivity("ACT-1 CCS Seminar", Department.CCS, null, sta, AccreditationArea.FACULTY);
        Activity actEmpty = saveActivity("ACT-EMPTY CCS", Department.CCS, null, sta, AccreditationArea.LIBRARY);
        UUID ev1 = uploadSamplePdf(act1, sta, "ev1.pdf", "ev1-original-bytes");

        // TC-M1-UC4-01, 02, 03: Creator (STA), Same-dept Chair (CHA), and Admin (ADM) can edit ACT-1
        for (User editor : List.of(sta, cha, adm)) {
            mvc.perform(put("/api/activities/" + act1.getId())
                            .cookie(auth(editor))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of(
                                    "activityName", "ACT-1 Updated by " + editor.getRole(),
                                    "description", "Updated description",
                                    "activityType", "SEMINAR",
                                    "activityDate", LocalDate.now().toString(),
                                    "accreditationArea", "FACULTY",
                                    "academicYear", "2026-2027"
                            ))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.activityName").value("ACT-1 Updated by " + editor.getRole()));
        }

        // TC-M1-UC4-05: Deleting activity with attached evidence is refused -> 400
        mvc.perform(delete("/api/activities/" + act1.getId()).cookie(auth(sta)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Activity has attached evidence and cannot be deleted"));

        // TC-M1-UC4-04: Deleting empty activity succeeds -> 204
        mvc.perform(delete("/api/activities/" + actEmpty.getId()).cookie(auth(sta)))
                .andExpect(status().isNoContent());

        // TC-M1-UC4-08: Unauthorized edit/delete by STB and CHB refused -> 403
        mvc.perform(put("/api/activities/" + act1.getId())
                        .cookie(auth(stb))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityName", "Unauthorized Edit",
                                "activityType", "SEMINAR",
                                "activityDate", LocalDate.now().toString(),
                                "accreditationArea", "FACULTY",
                                "academicYear", "2026-2027"
                        ))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("You are not authorized to edit this activity"));

        mvc.perform(delete("/api/evidence/" + ev1).cookie(auth(stb)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Only the uploader can modify this evidence"));

        mvc.perform(delete("/api/evidence/" + ev1).cookie(auth(chb)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Chairperson can only modify evidence within their department"));

        // TC-M1-UC4-09: Non-existent UUID returns 404
        mvc.perform(delete("/api/evidence/" + UUID.randomUUID()).cookie(auth(adm)))
                .andExpect(status().isNotFound());
    }

    // =========================================================================
    // CASE 5 & 6: Repository Search, View, Download & Scoping (M2-UC1, M2-UC2, INC-08)
    // =========================================================================
    @Test
    void case05_and_06_repositorySearchViewDownloadAndScoping_M2_UC1_UC2_and_INC08() throws Exception {
        Activity ccsAct = saveActivity("CCS Research Colloquium", Department.CCS, null, sta, AccreditationArea.RESEARCH);
        Activity ceaAct = saveActivity("CEA Bridge Design Expo", Department.CEA, null, stb, AccreditationArea.LABORATORIES);

        UUID ccsEv = uploadSamplePdf(ccsAct, sta, "ccs-research.pdf", "ccs-pdf-bytes");
        UUID ceaPrivateEv = uploadSamplePdf(ceaAct, stb, "cea-private.pdf", "cea-private-bytes");
        UUID ceaSharedEv = uploadSamplePdf(ceaAct, stb, "cea-shared.pdf", "cea-shared-bytes");

        // Tag ceaSharedEv with COLLEGE_OF_COMPUTER_STUDIES so CCS can see it
        mvc.perform(put("/api/evidence/" + ceaSharedEv + "/metadata")
                        .cookie(auth(stb))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "evidenceType", "REPORT",
                                "relatedOffices", List.of("COLLEGE_OF_COMPUTER_STUDIES"),
                                "tags", List.of("interdisciplinary")
                        ))))
                .andExpect(status().isOk());

        // TC-M2-UC1-01 & 10: STA (CCS) searches repository -> sees ccsEv and ceaSharedEv, but NOT ceaPrivateEv
        String repoJson = mvc.perform(get("/api/evidence/repository").cookie(auth(sta)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(repoJson).contains("ccs-research.pdf", "cea-shared.pdf");
        assertThat(repoJson).doesNotContain("cea-private.pdf");

        // TC-M2-UC1-11: ADM and IOS see all evidence including ceaPrivateEv
        String adminRepoJson = mvc.perform(get("/api/evidence/repository").cookie(auth(adm)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(adminRepoJson).contains("ccs-research.pdf", "cea-shared.pdf", "cea-private.pdf");

        // TC-M2-UC1-12: Invalid filter parameter returns 400
        mvc.perform(get("/api/evidence/repository").param("areas", "NOT_AN_AREA").cookie(auth(sta)))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/evidence/repository").param("page", "-1").cookie(auth(sta)))
                .andExpect(status().isBadRequest());

        // TC-M2-UC2-01..05: View and download allowed evidence
        mvc.perform(get("/api/evidence/" + ccsEv + "/view").cookie(auth(sta)))
                .andExpect(status().isOk())
                .andExpect(content().bytes("ccs-pdf-bytes".getBytes(StandardCharsets.UTF_8)));

        mvc.perform(get("/api/evidence/" + ceaSharedEv + "/download").cookie(auth(sta)))
                .andExpect(status().isOk())
                .andExpect(content().bytes("cea-shared-bytes".getBytes(StandardCharsets.UTF_8)));

        // TC-M2-UC2-10 (INC-08): Direct URL access to unshared other-department evidence returns 404
        mvc.perform(get("/api/evidence/" + ceaPrivateEv).cookie(auth(sta)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/evidence/" + ceaPrivateEv + "/metadata").cookie(auth(sta)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/evidence/" + ceaPrivateEv + "/view").cookie(auth(sta)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/evidence/" + ceaPrivateEv + "/download").cookie(auth(sta)))
                .andExpect(status().isNotFound());
    }

    // =========================================================================
    // CASE 7 & 8: Reference Existing Evidence & Shared Evidence (M3-UC1, M3-UC2, INC-09)
    // =========================================================================
    @Test
    void case07_and_08_referenceAndSharedEvidence_M3_UC1_UC2_and_INC09() throws Exception {
        Activity ccsAct1 = saveActivity("CCS Target Activity", Department.CCS, null, sta, AccreditationArea.FACULTY);
        Activity ceaAct = saveActivity("CEA Source Activity", Department.CEA, null, stb, AccreditationArea.RESEARCH);
        UUID ceaSharedEv = uploadSamplePdf(ceaAct, stb, "cea-joint-paper.pdf", "joint-paper-bytes");

        // Tag CCS on ceaSharedEv
        mvc.perform(put("/api/evidence/" + ceaSharedEv + "/metadata")
                        .cookie(auth(stb))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "evidenceType", "REPORT",
                                "relatedOffices", List.of("COLLEGE_OF_COMPUTER_STUDIES")
                        ))))
                .andExpect(status().isOk());

        // TC-M3-UC1-09 (INC-09): STB (CEA) attempting to reference evidence into CCS activity (ccsAct1) -> 403
        mvc.perform(post("/api/evidence/" + ceaSharedEv + "/references")
                        .cookie(auth(stb))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityId", ccsAct1.getId().toString(),
                                "note", "Unauthorized cross-dept target activity"
                        ))))
                .andExpect(status().isForbidden());

        // TC-M3-UC1-05: Referencing evidence into its own source activity -> 400
        mvc.perform(post("/api/evidence/" + ceaSharedEv + "/references")
                        .cookie(auth(stb))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityId", ceaAct.getId().toString(),
                                "note", "Same activity"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Evidence is already uploaded under this activity"));

        // TC-M3-UC1-01 & 03: STA (CCS) references ceaSharedEv into ccsAct1 with 500-char note -> 200 OK
        String refBody = mvc.perform(post("/api/evidence/" + ceaSharedEv + "/references")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityId", ccsAct1.getId().toString(),
                                "note", "N".repeat(500)
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String refId = json.readTree(refBody).get("id").asText();

        // TC-M3-UC1-04: Duplicate reference into same activity -> 409 Conflict
        mvc.perform(post("/api/evidence/" + ceaSharedEv + "/references")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "activityId", ccsAct1.getId().toString(),
                                "note", "Duplicate reference"
                        ))))
                .andExpect(status().isConflict());

        // TC-M3-UC2-01 & 03: Shared evidence list and reference list
        mvc.perform(get("/api/evidence/shared").cookie(auth(stb)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].referenceCount").value(1));

        mvc.perform(get("/api/activities/" + ccsAct1.getId() + "/referenced-evidence").cookie(auth(sta)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        // TC-M3-UC2-07: Unrelated department user (STB, CEA) cannot delete CCS's reference -> 403
        mvc.perform(delete("/api/evidence/references/" + refId).cookie(auth(stb)))
                .andExpect(status().isForbidden());

        // TC-M3-UC2-05: Same-department colleague (CHA, CCS) or owner (STA) can delete reference -> 204
        mvc.perform(delete("/api/evidence/references/" + refId).cookie(auth(cha)))
                .andExpect(status().isNoContent());
    }

    // =========================================================================
    // CASE 9: Manage Users and Permissions (M4-UC1)
    // =========================================================================
    @Test
    void case09_manageUsersAndPermissions_M4_UC1() throws Exception {
        // TC-M4-UC1-01: Admin invites single user -> 201 Created
        String createdBody = mvc.perform(post("/api/admin/users")
                        .cookie(auth(adm))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "name", "New CCS Staff",
                                "email", "new-ccs-staff@cit.edu",
                                "office", "CCS",
                                "role", "DEPT_STAFF"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("new-ccs-staff@cit.edu"))
                .andReturn().getResponse().getContentAsString();
        UUID newUserId = UUID.fromString(json.readTree(createdBody).get("id").asText());

        // TC-M4-UC1-10: Duplicate email rejected -> 400
        mvc.perform(post("/api/admin/users")
                        .cookie(auth(adm))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "name", "Duplicate User",
                                "email", "new-ccs-staff@cit.edu",
                                "office", "CCS",
                                "role", "DEPT_STAFF"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("A user with this email already exists"));

        // TC-M4-UC1-13: Chairperson (CHA) cannot assign ADMIN or INSTITUTIONAL_OFFICE role -> 403
        mvc.perform(post("/api/admin/users")
                        .cookie(auth(cha))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "name", "Unauthorized Admin",
                                "email", "unauth-admin@cit.edu",
                                "office", "CCS",
                                "role", "ADMIN"
                        ))))
                .andExpect(status().isForbidden());

        // TC-M4-UC1-14: Chairperson (CHA, CCS) cannot manage CEA user (STB) -> 403
        mvc.perform(patch("/api/admin/users/" + stb.getId() + "/status")
                        .cookie(auth(cha))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("active", false))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Chairpersons can only manage users within their own department"));

        // TC-M4-UC1-08: Force logout (revoke-sessions) increments tokenVersion and invalidates existing JWT
        Cookie oldCookie = auth( userRepository.findById(newUserId).orElseThrow() );
        mvc.perform(post("/api/admin/users/" + newUserId + "/revoke-sessions").cookie(auth(adm)))
                .andExpect(status().isOk());

        mvc.perform(get("/api/auth/me").cookie(oldCookie))
                .andExpect(status().isUnauthorized());

        // TC-M4-UC1-15: Department Staff (STA) cannot access /api/admin/users -> 403
        mvc.perform(get("/api/admin/users").cookie(auth(sta)))
                .andExpect(status().isForbidden());
    }

    // =========================================================================
    // CASE 10 & 11: Accreditor Access, Portal & Version Sync (M4-UC2, M4-UC3)
    // =========================================================================
    @Test
    void case10_and_11_accreditorAccessAndPortal_M4_UC2_UC3_and_VersionSync() throws Exception {
        Activity ccsAct = saveActivity("CCS Capstone Exhibit 2026", Department.CCS, null, sta, AccreditationArea.INSTRUCTION);
        byte[] v1Bytes = "%PDF-1.4 Exhibit Brochure v1".getBytes(StandardCharsets.UTF_8);
        byte[] v2Bytes = "%PDF-1.4 Exhibit Brochure v2 Updated".getBytes(StandardCharsets.UTF_8);
        UUID evId = uploadSamplePdfBytes(ccsAct, sta, "brochure-v1.pdf", v1Bytes);

        // TC-M4-UC2-01: Generate accreditor access link
        String genBody = mvc.perform(post("/api/accreditor-access/generate")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "name", "CCS Exhibit Review Link",
                                "activityId", ccsAct.getId().toString(),
                                "accreditorIds", List.of(acc1.getId().toString()),
                                "expirationDateTime", OffsetDateTime.now().plusDays(7).toString(),
                                "notes", "For PACUCOA Area I & II review"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("CCS Exhibit Review Link"))
                .andReturn().getResponse().getContentAsString();
        UUID linkId = UUID.fromString(json.readTree(genBody).get("id").asText());

        // TC-M4-UC2-05: Sharing same activity with same accreditor while active link exists -> 409 Conflict
        mvc.perform(post("/api/accreditor-access/generate")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "name", "Duplicate Share",
                                "activityId", ccsAct.getId().toString(),
                                "accreditorIds", List.of(acc1.getId().toString())
                        ))))
                .andExpect(status().isConflict());

        // TC-M4-UC3-01..03: Accreditor 1 opens link and views v1
        mvc.perform(get("/api/accreditor/links/" + linkId).cookie(auth(acc1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidence[0].originalFileName").value("brochure-v1.pdf"))
                .andExpect(jsonPath("$.evidence[0].currentVersion").value(1));

        mvc.perform(get("/api/accreditor/links/" + linkId + "/evidence/" + evId + "/view")
                        .cookie(auth(acc1)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().bytes(v1Bytes));

        // Direct iframe navigation is blocked -> 403
        mvc.perform(get("/api/accreditor/links/" + linkId + "/evidence/" + evId + "/view")
                        .header("Sec-Fetch-Dest", "iframe")
                        .cookie(auth(acc1)))
                .andExpect(status().isForbidden());

        // Staff replaces file with v2 -> Accreditor immediately sees v2 metadata and v2 file bytes!
        MockMultipartFile v2File = new MockMultipartFile("file", "brochure-v2.pdf", "application/pdf", v2Bytes);
        mvc.perform(multipart("/api/evidence/" + evId + "/replace")
                        .file(v2File)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .cookie(auth(sta)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion").value(2));

        mvc.perform(get("/api/accreditor/links/" + linkId).cookie(auth(acc1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidence[0].originalFileName").value("brochure-v2.pdf"))
                .andExpect(jsonPath("$.evidence[0].currentVersion").value(2))
                .andExpect(jsonPath("$.evidence[0].fileSize").value(v2Bytes.length));

        mvc.perform(get("/api/accreditor/links/" + linkId + "/evidence/" + evId + "/view")
                        .cookie(auth(acc1)))
                .andExpect(status().isOk())
                .andExpect(content().bytes(v2Bytes));

        // Staff restores v1 -> Accreditor immediately sees v1 again without any v3 created!
        String versionsJson = mvc.perform(get("/api/evidence/" + evId + "/versions").cookie(auth(sta)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode versions = json.readTree(versionsJson);
        String v1VerId = versions.get(1).get("id").asText();

        mvc.perform(post("/api/evidence/" + evId + "/versions/" + v1VerId + "/restore").cookie(auth(sta)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion").value(1));

        mvc.perform(get("/api/accreditor/links/" + linkId).cookie(auth(acc1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidence[0].originalFileName").value("brochure-v1.pdf"))
                .andExpect(jsonPath("$.evidence[0].currentVersion").value(1));

        mvc.perform(get("/api/accreditor/links/" + linkId + "/evidence/" + evId + "/view")
                        .cookie(auth(acc1)))
                .andExpect(status().isOk())
                .andExpect(content().bytes(v1Bytes));

        // TC-M4-UC3-06: Unassigned accreditor (ACC2) gets 404
        mvc.perform(get("/api/accreditor/links/" + linkId).cookie(auth(acc2)))
                .andExpect(status().isNotFound());
    }

    // =========================================================================
    // CASE 12: Authentication & Password Management (M4-UC4, INC-01, INC-02)
    // =========================================================================
    @Test
    void case12_authenticationAndPasswordManagement_M4_UC4_and_INC01_INC02() throws Exception {
        // TC-M4-UC4-01: Valid login returns 200 and sets aercs_token cookie
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", "tu-staff-ccs@cit.edu",
                                "password", "TestPass123!"
                        ))))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("aercs_token"))
                .andExpect(jsonPath("$.name").value("CCS Staff"))
                .andExpect(jsonPath("$.role").value("DEPT_STAFF"));

        // TC-M4-UC4-10 (INC-02): Expired reset token rejected -> 400
        User refreshed = userRepository.findById(sta.getId()).orElseThrow();
        refreshed.setResetToken("expired-token-123");
        refreshed.setResetTokenExpiresAt(OffsetDateTime.now().minusMinutes(5));
        userRepository.saveAndFlush(refreshed);

        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "token", "expired-token-123",
                                "newPassword", "NewValidPass123!"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid or expired reset link"));

        // TC-M4-UC4-07, 08 & TC-M4-UC4-11 (INC-01): Request reset via forgot-password, use token once, and verify reuse is rejected
        mvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", "tu-staff-ccs@cit.edu"))))
                .andExpect(status().isNoContent());

        User afterForgot = userRepository.findById(sta.getId()).orElseThrow();
        String validToken = afterForgot.getResetToken();
        assertThat(validToken).isNotBlank();
        assertThat(afterForgot.getResetTokenExpiresAt()).isAfter(OffsetDateTime.now());
        assertThat(userRepository.findByResetToken(validToken)).isPresent();

        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "token", validToken,
                                "newPassword", "NewValidPass123!"
                        ))))
                .andExpect(status().isNoContent());

        // Reusing the same reset token a second time (INC-01) -> 400
        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "token", validToken,
                                "newPassword", "AnotherPass123!"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid or expired reset link"));

        // TC-M4-UC4-06: 5 failed login attempts locks account -> 6th attempt returns 429 Too Many Requests
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of(
                                    "email", "tu-staff-cea@cit.edu",
                                    "password", "WrongPass!"
                            ))))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", "tu-staff-cea@cit.edu",
                                "password", "WrongPass!"
                        ))))
                .andExpect(status().isTooManyRequests());
    }

    // =========================================================================
    // CASE 13 & 15: Dashboard Summary (M5-UC1) & Security / Input Handling (NFR-S, INC-03..05)
    // =========================================================================
    @Test
    void case13_and_15_dashboardAndSecurity_M5_UC1_NFR_S_and_INC03_INC04_INC05() throws Exception {
        Activity ccsAct = saveActivity("CCS Dashboard Activity", Department.CCS, null, sta, AccreditationArea.FACULTY);
        uploadSamplePdf(ccsAct, sta, "untagged.pdf", "untagged-bytes");

        // TC-M5-UC1-01..03: Dashboard summary returns overview counts
        mvc.perform(get("/api/dashboard/summary").cookie(auth(sta)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.overview.totalActivities").value(1))
                .andExpect(jsonPath("$.overview.uploadedEvidence").value(1))
                .andExpect(jsonPath("$.overview.evidenceNeedingMetadata").value(1));

        // TC-NFR-S-01: Unauthenticated request -> 401
        mvc.perform(get("/api/activities"))
                .andExpect(status().isUnauthorized());

        // TC-NFR-S-03 (INC-03): Forged / invalid Bearer token -> 401
        mvc.perform(get("/api/activities")
                        .header("Authorization", "Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9."))
                .andExpect(status().isUnauthorized());

        // TC-NFR-S-06 (INC-04): Malformed UUID in path -> 400 Bad Request
        mvc.perform(get("/api/activities/not-a-valid-uuid").cookie(auth(sta)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid value for parameter 'id'"));

        // TC-NFR-S-07: Malformed JSON -> 400 Bad Request
        mvc.perform(post("/api/activities")
                        .cookie(auth(sta))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{bad-json"))
                .andExpect(status().isBadRequest());

        // TC-NFR-S-08 (INC-05): Accreditor blocked from internal endpoints and write operations -> 403
        mvc.perform(get("/api/activities").cookie(auth(acc1)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/evidence/repository").cookie(auth(acc1)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/accreditor/links").cookie(auth(acc1)))
                .andExpect(status().isForbidden());

        // TC-NFR-S-05: SQL injection string in repository search handled safely -> 200 OK
        mvc.perform(get("/api/evidence/repository")
                        .param("keyword", "' OR 1=1 --")
                        .cookie(auth(sta)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    private Activity saveActivity(String name, Department dept, String office, User creator, AccreditationArea area) {
        Activity a = new Activity();
        a.setActivityName(name);
        a.setActivityType(ActivityType.SEMINAR);
        a.setActivityDate(LocalDate.now());
        a.setDepartment(dept);
        a.setOffice(office);
        a.setAccreditationArea(area);
        a.setAcademicYear("2026-2027");
        a.setCreatedBy(creator);
        return activityRepository.save(a);
    }

    private UUID uploadSamplePdf(Activity act, User uploader, String fileName, String content) throws Exception {
        return uploadSamplePdfBytes(act, uploader, fileName, content.getBytes(StandardCharsets.UTF_8));
    }

    private UUID uploadSamplePdfBytes(Activity act, User uploader, String fileName, byte[] bytes) throws Exception {
        MockMultipartFile file = new MockMultipartFile("files", fileName, "application/pdf", bytes);
        String body = mvc.perform(multipart("/api/activities/" + act.getId() + "/evidence/upload")
                        .file(file)
                        .cookie(auth(uploader)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(body).get(0).get("id").asText());
    }
}

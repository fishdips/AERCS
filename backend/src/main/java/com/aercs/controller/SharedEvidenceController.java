package com.aercs.controller;

import com.aercs.dto.request.ReferenceRequest;
import com.aercs.dto.response.ActivityReferencedEvidenceResponse;
import com.aercs.dto.response.ReferenceResponse;
import com.aercs.dto.response.RepositoryEvidenceResponse;
import com.aercs.dto.response.SharedEvidenceResponse;
import com.aercs.entity.AccreditationArea;
import com.aercs.entity.ActivityType;
import com.aercs.entity.EvidenceType;
import com.aercs.entity.UserRole;
import com.aercs.repository.UserRepository;
import com.aercs.service.SharedEvidenceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class SharedEvidenceController {

    private static final String WRITE_ROLES = "hasAnyRole('ADMIN', 'DEPT_STAFF', 'ACCRED_COORDINATOR', 'INSTITUTIONAL_OFFICE')";

    private final SharedEvidenceService sharedEvidenceService;
    private final UserRepository userRepository;

    @GetMapping({"/api/evidence/shared", "/api/evidence/referenced"})
    public ResponseEntity<Page<SharedEvidenceResponse>> searchEvidence(
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String academicYear,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        AccreditationArea areaEnum = parseArea(area);
        Pageable pageable = PageRequest.of(page, size);
        UUID currentUserId = UUID.fromString(userDetails.getUsername());

        return ResponseEntity.ok(sharedEvidenceService.searchEvidence(
                areaEnum, academicYear, keyword, currentUserId, pageable
        ));
    }

    @PostMapping("/api/evidence/{evidenceId}/references")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<ReferenceResponse> createReference(
            @PathVariable UUID evidenceId,
            @Valid @RequestBody ReferenceRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        UUID currentUserId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(sharedEvidenceService.createReference(evidenceId, request, currentUserId));
    }

    @GetMapping("/api/evidence/{evidenceId}/references")
    public ResponseEntity<Page<ReferenceResponse>> getReferences(
            @PathVariable UUID evidenceId,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        AccreditationArea areaEnum = parseArea(area);
        Pageable pageable = PageRequest.of(page, size);

        return ResponseEntity.ok(sharedEvidenceService.getReferences(
                evidenceId, department, areaEnum, startDate, endDate, pageable
        ));
    }

    @DeleteMapping("/api/evidence/references/{referenceId}")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<Void> deleteReference(
            @PathVariable UUID referenceId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        UUID currentUserId = UUID.fromString(userDetails.getUsername());
        UserRole currentUserRole = resolveRole(userDetails.getUsername());
        sharedEvidenceService.deleteReference(referenceId, currentUserId, currentUserRole);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/activities/{activityId}/referenced-evidence")
    public ResponseEntity<List<ActivityReferencedEvidenceResponse>> getActivityReferencedEvidence(
            @PathVariable UUID activityId
    ) {
        return ResponseEntity.ok(sharedEvidenceService.getReferencedEvidenceForActivity(activityId));
    }

    @GetMapping("/api/evidence/repository")
    public ResponseEntity<Page<RepositoryEvidenceResponse>> searchRepository(
            @RequestParam(required = false) String areas,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String academicYear,
            @RequestParam(required = false) String activityTypes,
            @RequestParam(required = false) String fileTypes,
            @RequestParam(required = false) String evidenceTypes,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        List<AccreditationArea> areaList = parseAreaList(areas);
        List<ActivityType> typeList = parseActivityTypeList(activityTypes);
        List<String> fileTypeList = parseStringList(fileTypes);
        List<EvidenceType> evidenceTypeList = parseEvidenceTypeList(evidenceTypes);
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(sharedEvidenceService.searchRepository(
                keyword, areaList, department, academicYear, typeList, fileTypeList, evidenceTypeList, dateFrom, dateTo, pageable
        ));
    }

    private List<AccreditationArea> parseAreaList(String areas) {
        if (areas == null || areas.isBlank()) return null;
        return Arrays.stream(areas.split(","))
                .map(String::trim)
                .map(s -> { try { return AccreditationArea.valueOf(s.toUpperCase()); } catch (IllegalArgumentException e) { return null; } })
                .filter(Objects::nonNull)
                .toList();
    }

    private List<ActivityType> parseActivityTypeList(String types) {
        if (types == null || types.isBlank()) return null;
        return Arrays.stream(types.split(","))
                .map(String::trim)
                .map(s -> { try { return ActivityType.valueOf(s.toUpperCase()); } catch (IllegalArgumentException e) { return null; } })
                .filter(Objects::nonNull)
                .toList();
    }

    private List<EvidenceType> parseEvidenceTypeList(String types) {
        if (types == null || types.isBlank()) return null;
        return Arrays.stream(types.split(","))
                .map(String::trim)
                .map(s -> { try { return EvidenceType.valueOf(s.toUpperCase()); } catch (IllegalArgumentException e) { return null; } })
                .filter(Objects::nonNull)
                .toList();
    }

    private List<String> parseStringList(String values) {
        if (values == null || values.isBlank()) return null;
        return Arrays.stream(values.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private AccreditationArea parseArea(String area) {
        if (area == null || area.isBlank()) return null;
        try {
            return AccreditationArea.valueOf(area.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private UserRole resolveRole(String userId) {
        return userRepository.findById(UUID.fromString(userId))
                .map(u -> u.getRole())
                .orElse(UserRole.DEPT_STAFF);
    }
}

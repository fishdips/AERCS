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
import com.aercs.exception.BadRequestException;
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
        Pageable pageable = pageable(page, size);
        UUID currentUserId = resolveUserId(userDetails);

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
        UUID currentUserId = resolveUserId(userDetails);
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
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        AccreditationArea areaEnum = parseArea(area);
        Pageable pageable = pageable(page, size);

        return ResponseEntity.ok(sharedEvidenceService.getReferences(
                evidenceId, department, areaEnum, startDate, endDate, pageable,
                userDetails != null ? userDetails.getUsername() : null
        ));
    }

    @DeleteMapping("/api/evidence/references/{referenceId}")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<Void> deleteReference(
            @PathVariable UUID referenceId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        UUID currentUserId = resolveUserId(userDetails);
        UserRole currentUserRole = resolveRole(userDetails != null ? userDetails.getUsername() : null);
        sharedEvidenceService.deleteReference(referenceId, currentUserId, currentUserRole);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/activities/{activityId}/referenced-evidence")
    public ResponseEntity<List<ActivityReferencedEvidenceResponse>> getActivityReferencedEvidence(
            @PathVariable UUID activityId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(sharedEvidenceService.getReferencedEvidenceForActivity(
                activityId, userDetails != null ? userDetails.getUsername() : null));
    }

    @GetMapping("/api/evidence/repository")
    public ResponseEntity<Page<RepositoryEvidenceResponse>> searchRepository(
            @RequestParam(required = false) String areas,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String academicYear,
            @RequestParam(required = false) String academicYearFrom,
            @RequestParam(required = false) String academicYearTo,
            @RequestParam(required = false) String activityTypes,
            @RequestParam(required = false) String fileTypes,
            @RequestParam(required = false) String evidenceTypes,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        validateAcademicYearRange(academicYearFrom, academicYearTo);
        List<AccreditationArea> areaList = parseAreaList(areas);
        List<ActivityType> typeList = parseActivityTypeList(activityTypes);
        List<String> fileTypeList = parseStringList(fileTypes);
        List<EvidenceType> evidenceTypeList = parseEvidenceTypeList(evidenceTypes);
        Pageable pageable = pageable(page, size);
        UUID currentUserId = resolveUserId(userDetails);
        return ResponseEntity.ok(sharedEvidenceService.searchRepository(
                keyword, areaList, department, academicYear, academicYearFrom, academicYearTo,
                typeList, fileTypeList, evidenceTypeList,
                dateFrom, dateTo, currentUserId, pageable
        ));
    }

    // Academic years are stored as "YYYY-YYYY" (e.g. 2025-2026), which sorts correctly as text,
    // so a range can be compared directly. Reject anything else instead of silently matching nothing.
    private void validateAcademicYearRange(String from, String to) {
        String start = from == null ? "" : from.trim();
        String end = to == null ? "" : to.trim();
        for (String value : new String[] {start, end}) {
            if (!value.isEmpty() && !value.matches("\\d{4}-\\d{4}")) {
                throw new BadRequestException("Academic year must look like 2025-2026");
            }
        }
        if (!start.isEmpty() && !end.isEmpty() && start.compareTo(end) > 0) {
            throw new BadRequestException("Academic year range is backwards: 'from' is after 'to'");
        }
    }

    private List<AccreditationArea> parseAreaList(String areas) {
        return parseEnumList(areas, AccreditationArea.class, "area");
    }

    private List<ActivityType> parseActivityTypeList(String types) {
        return parseEnumList(types, ActivityType.class, "activity type");
    }

    private List<EvidenceType> parseEvidenceTypeList(String types) {
        return parseEnumList(types, EvidenceType.class, "evidence type");
    }

    // Unknown values are a client error, not "no filter" - silently ignoring them
    // returned 200 with unfiltered data for a malformed request.
    private <E extends Enum<E>> List<E> parseEnumList(String values, Class<E> type, String label) {
        if (values == null || values.isBlank()) return null;
        return Arrays.stream(values.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> parseEnum(s, type, label))
                .toList();
    }

    private <E extends Enum<E>> E parseEnum(String value, Class<E> type, String label) {
        try {
            return Enum.valueOf(type, value.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid " + label + ": " + value);
        }
    }

    private List<String> parseStringList(String values) {
        if (values == null || values.isBlank()) return null;
        return Arrays.stream(values.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private AccreditationArea parseArea(String area) {
        if (area == null || area.isBlank()) return null;
        return parseEnum(area.trim(), AccreditationArea.class, "area");
    }

    private Pageable pageable(int page, int size) {
        if (page < 0) throw new BadRequestException("Page must not be negative");
        if (size < 1 || size > 100) throw new BadRequestException("Size must be between 1 and 100");
        return PageRequest.of(page, size);
    }

    private UUID resolveUserId(UserDetails userDetails) {
        if (userDetails == null || userDetails.getUsername() == null) return null;
        return userRepository.findByIdentifier(userDetails.getUsername())
                .map(u -> u.getId())
                .orElse(null);
    }

    private UserRole resolveRole(String identifier) {
        if (identifier == null) return UserRole.DEPT_STAFF;
        return userRepository.findByIdentifier(identifier)
                .map(u -> u.getRole())
                .orElse(UserRole.DEPT_STAFF);
    }
}

package com.aercs.service;

import com.aercs.dto.request.ReferenceRequest;
import com.aercs.dto.response.ActivityReferencedEvidenceResponse;
import com.aercs.dto.response.ReferenceResponse;
import com.aercs.dto.response.RepositoryEvidenceResponse;
import com.aercs.dto.response.SharedEvidenceResponse;
import com.aercs.entity.*;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ConflictException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.*;
import jakarta.persistence.criteria.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SharedEvidenceService {

    private final EvidenceRepository evidenceRepository;
    private final EvidenceReferenceRepository referenceRepository;
    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;

    private static final EnumMap<Department, RelatedOffice> DEPARTMENT_TO_RELATED = new EnumMap<>(Department.class);
    private static final EnumMap<Office, RelatedOffice> OFFICE_TO_RELATED = new EnumMap<>(Office.class);

    static {
        DEPARTMENT_TO_RELATED.put(Department.CCS, RelatedOffice.COLLEGE_OF_COMPUTER_STUDIES);
        DEPARTMENT_TO_RELATED.put(Department.CEA, RelatedOffice.COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE);
        DEPARTMENT_TO_RELATED.put(Department.CNAHS, RelatedOffice.COLLEGE_OF_NURSING);
        DEPARTMENT_TO_RELATED.put(Department.CMBA, RelatedOffice.COLLEGE_OF_MANAGEMENT_BUSINESS_AND_ACCOUNTANCY);
        DEPARTMENT_TO_RELATED.put(Department.CASE, RelatedOffice.COLLEGE_OF_ARTS_AND_SCIENCES);

        OFFICE_TO_RELATED.put(Office.QUALITY_ASSURANCE_OFFICE, RelatedOffice.QUALITY_ASSURANCE_OFFICE);
        OFFICE_TO_RELATED.put(Office.RESEARCH_OFFICE, RelatedOffice.RESEARCH_OFFICE);
        OFFICE_TO_RELATED.put(Office.EXTENSION_OFFICE, RelatedOffice.EXTENSION_OFFICE);
        OFFICE_TO_RELATED.put(Office.REGISTRARS_OFFICE, RelatedOffice.REGISTRARS_OFFICE);
        OFFICE_TO_RELATED.put(Office.LIBRARY, RelatedOffice.LIBRARY);
        OFFICE_TO_RELATED.put(Office.STUDENT_AFFAIRS_OFFICE, RelatedOffice.STUDENT_AFFAIRS_OFFICE);
        OFFICE_TO_RELATED.put(Office.FACILITIES_MANAGEMENT_OFFICE, RelatedOffice.FACILITIES_MANAGEMENT_OFFICE);
        OFFICE_TO_RELATED.put(Office.HUMAN_RESOURCE_OFFICE, RelatedOffice.HUMAN_RESOURCE_OFFICE);
    }

    @Transactional(readOnly = true)
    public Page<SharedEvidenceResponse> searchEvidence(
            AccreditationArea area,
            String academicYear,
            String keyword,
            UUID currentUserId,
            Pageable pageable
    ) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Department deptScope = currentUser.resolveDepartment();
        if (deptScope == null) {
            return Page.empty(pageable);
        }

        List<UUID> referencedIds = referenceRepository.findReferencedEvidenceIds();
        if (referencedIds.isEmpty()) {
            return Page.empty(pageable);
        }
        Specification<Evidence> spec = buildSearchSpec(
                area,
                blankToNull(academicYear),
                deptScope,
                blankToNull(keyword),
                referencedIds
        );
        Pageable sorted = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "uploadedAt")
        );
        Page<Evidence> page = evidenceRepository.findAll(spec, sorted);

        List<UUID> ids = page.getContent().stream().map(Evidence::getId).toList();
        Map<UUID, Long> counts = fetchCounts(ids);
        Map<UUID, List<String>> offices = fetchReferencingOffices(ids);

        return page.map(e -> toSharedResponse(e, counts.getOrDefault(e.getId(), 0L),
                offices.getOrDefault(e.getId(), List.of())));
    }

    @Transactional
    public ReferenceResponse createReference(UUID evidenceId, ReferenceRequest request, UUID currentUserId) {
        Evidence evidence = evidenceRepository.findById(evidenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Evidence file not found"));

        Activity activity = activityRepository.findById(request.activityId())
                .orElseThrow(() -> new ResourceNotFoundException("Activity not found"));

        if (evidence.getActivity().getId().equals(activity.getId())) {
            throw new BadRequestException("Evidence is already uploaded under this activity");
        }

        if (referenceRepository.existsByEvidenceIdAndActivityId(evidenceId, request.activityId())) {
            throw new ConflictException("This evidence file is already referenced in that activity");
        }

        User referencedBy = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        AccreditationArea area = request.accreditationArea() != null
                ? request.accreditationArea()
                : activity.getAccreditationArea();

        EvidenceReference ref = new EvidenceReference();
        ref.setEvidence(evidence);
        ref.setReferencedBy(referencedBy);
        ref.setActivity(activity);
        ref.setReferencedByOffice(resolveReferenceOffice(request.referencedByOffice(), referencedBy, activity));
        ref.setAccreditationArea(area);
        ref.setNote(trimToNull(request.note()));

        return toReferenceResponse(referenceRepository.save(ref));
    }

    @Transactional(readOnly = true)
    public Page<ReferenceResponse> getReferences(
            UUID evidenceId,
            String department,
            AccreditationArea area,
            OffsetDateTime startDate,
            OffsetDateTime endDate,
            Pageable pageable
    ) {
        evidenceRepository.findById(evidenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Evidence file not found"));

        Specification<EvidenceReference> spec = buildRefSpec(
                evidenceId, blankToNull(department), area, startDate, endDate);
        Pageable sorted = PageRequest.of(
                pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        return referenceRepository.findAll(spec, sorted).map(this::toReferenceResponse);
    }

    private Specification<EvidenceReference> buildRefSpec(
            UUID evidenceId, String department, AccreditationArea area,
            OffsetDateTime startDate, OffsetDateTime endDate) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("evidence").get("id"), evidenceId));
            if (department != null) {
                Join<EvidenceReference, User> user = root.join("referencedBy", JoinType.INNER);
                predicates.add(cb.or(
                        cb.equal(root.get("referencedByOffice"), department),
                        cb.equal(user.get("office"), department)
                ));
            }
            if (area != null) {
                predicates.add(cb.equal(root.get("accreditationArea"), area));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startDate));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endDate));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Transactional
    public void deleteReference(UUID referenceId, UUID currentUserId, UserRole currentUserRole) {
        EvidenceReference ref = referenceRepository.findById(referenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Reference not found"));
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        boolean isOwner = ref.getReferencedBy() != null && ref.getReferencedBy().getId().equals(currentUserId);
        String userOrgUnit = currentUser.getOffice();
        boolean isSameOffice = userOrgUnit != null && userOrgUnit.equalsIgnoreCase(ref.getReferencedByOffice());
        boolean isAdmin = currentUserRole == UserRole.ADMIN || currentUserRole == UserRole.ACCRED_COORDINATOR;

        if (!isOwner && !isSameOffice && !isAdmin) {
            throw new BadRequestException("Only the referencing user, accreditation coordinator, or administrator can delete it");
        }

        referenceRepository.delete(ref);
    }

    @Transactional(readOnly = true)
    public List<ActivityReferencedEvidenceResponse> getReferencedEvidenceForActivity(UUID activityId) {
        activityRepository.findById(activityId)
                .orElseThrow(() -> new ResourceNotFoundException("Activity not found"));

        return referenceRepository.findByActivityIdOrderByCreatedAtDesc(activityId).stream()
                .map(this::toActivityReferencedEvidenceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<RepositoryEvidenceResponse> searchRepository(
            String keyword,
            List<AccreditationArea> areas,
            String department,
            String academicYear,
            List<ActivityType> activityTypes,
            List<String> fileTypes,
            List<EvidenceType> evidenceTypes,
            LocalDate dateFrom,
            LocalDate dateTo,
            UUID currentUserId,
            Pageable pageable
    ) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        boolean isDeptStaff = currentUser.getRole() == UserRole.DEPT_STAFF;
        Department viewerDept = isDeptStaff ? currentUser.resolveDepartment() : null;
        RelatedOffice viewerRelatedOffice = viewerDept != null ? DEPARTMENT_TO_RELATED.get(viewerDept) : null;

        // DEPT_STAFF see only their own dept + files referenced to them; ignore the frontend dept filter
        String effectiveDept = isDeptStaff ? null : blankToNull(department);

        Specification<Evidence> spec = buildRepositorySpec(
                blankToNull(keyword), areas, effectiveDept,
                blankToNull(academicYear), activityTypes, fileTypes, evidenceTypes, dateFrom, dateTo,
                viewerDept, viewerRelatedOffice
        );
        Pageable sorted = PageRequest.of(
                pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "uploadedAt")
        );
        Page<Evidence> page = evidenceRepository.findAll(spec, sorted);
        List<UUID> ids = page.getContent().stream().map(Evidence::getId).toList();
        Map<UUID, Long> counts = fetchCounts(ids);
        return page.map(e -> toRepositoryResponse(e, counts.getOrDefault(e.getId(), 0L), viewerDept));
    }

    private Specification<Evidence> buildRepositorySpec(
            String keyword,
            List<AccreditationArea> areas,
            String department,
            String academicYear,
            List<ActivityType> activityTypes,
            List<String> fileTypes,
            List<EvidenceType> evidenceTypes,
            LocalDate dateFrom,
            LocalDate dateTo,
            Department viewerDepartment,
            RelatedOffice viewerRelatedOffice
    ) {
        return (root, query, cb) -> {
            Join<Evidence, Activity> act = root.join("activity", JoinType.INNER);
            List<Predicate> predicates = new ArrayList<>();

            // DEPT_STAFF: restrict to own department's files OR files referenced to their dept
            if (viewerDepartment != null) {
                Predicate ownDept = cb.equal(act.get("department"), viewerDepartment);
                if (viewerRelatedOffice != null) {
                    Predicate referenced = cb.and(
                            cb.isNotNull(root.get("relatedOffices")),
                            cb.like(root.get("relatedOffices"), "%" + viewerRelatedOffice.name() + "%")
                    );
                    predicates.add(cb.or(ownDept, referenced));
                } else {
                    predicates.add(ownDept);
                }
            }

            if (areas != null && !areas.isEmpty()) {
                predicates.add(act.get("accreditationArea").in(areas));
            }
            if (department != null) {
                // Try to parse as Department enum first, then Office enum
                Department deptEnum = tryParseDepartment(department);
                Office officeEnum = tryParseOffice(department);
                if (deptEnum != null) {
                    predicates.add(cb.equal(act.get("department"), deptEnum));
                } else if (officeEnum != null) {
                    predicates.add(cb.equal(act.get("office"), officeEnum.name()));
                } else {
                    predicates.add(cb.equal(cb.lower(act.get("office")), department.toLowerCase()));
                }
            }
            if (academicYear != null) {
                predicates.add(cb.equal(act.get("academicYear"), academicYear));
            }
            if (activityTypes != null && !activityTypes.isEmpty()) {
                predicates.add(act.get("activityType").in(activityTypes));
            }
            if (fileTypes != null && !fileTypes.isEmpty()) {
                List<String> upper = fileTypes.stream().map(String::toUpperCase).toList();
                predicates.add(root.get("fileType").in(upper));
            }
            if (evidenceTypes != null && !evidenceTypes.isEmpty()) {
                predicates.add(root.get("evidenceType").in(evidenceTypes));
            }
            if (dateFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("uploadedAt"),
                        dateFrom.atStartOfDay().atOffset(ZoneOffset.UTC)));
            }
            if (dateTo != null) {
                predicates.add(cb.lessThan(root.get("uploadedAt"),
                        dateTo.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC)));
            }
            if (keyword != null) {
                String kw = "%" + keyword.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("originalFileName")), kw),
                        cb.like(cb.lower(act.get("activityName")), kw),
                        cb.and(cb.isNotNull(root.get("tags")), cb.like(cb.lower(root.get("tags")), kw)),
                        cb.and(cb.isNotNull(root.get("notes")), cb.like(cb.lower(root.get("notes")), kw))
                ));
            }

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private RepositoryEvidenceResponse toRepositoryResponse(Evidence e, long refCount, Department viewerDepartment) {
        Activity activity = e.getActivity();
        User uploader = e.getUploadedBy();
        boolean referencedToViewer = false;
        if (viewerDepartment != null) {
            referencedToViewer = activity.getDepartment() != viewerDepartment;
        }
        return new RepositoryEvidenceResponse(
                e.getId(),
                activity.getId(),
                activity.getActivityName(),
                activity.getActivityType(),
                e.getOriginalFileName(),
                e.getLinkUrl(),
                e.getFileType(),
                e.getFileSize(),
                activity.getAccreditationArea(),
                activity.getAcademicYear(),
                activity.getDepartment() != null ? activity.getDepartment().name() : null,
                activity.getOffice(),
                e.getEvidenceType(),
                uploader == null ? null : uploader.getName(),
                uploader == null ? null : uploader.getOffice(),
                e.getUploadedAt(),
                refCount,
                referencedToViewer
        );
    }

    private Specification<Evidence> buildSearchSpec(
            AccreditationArea area,
            String academicYear,
            Department department,
            String keyword,
            List<UUID> evidenceIds
    ) {
        return (root, query, cb) -> {
            Join<Evidence, Activity> act = root.join("activity", JoinType.INNER);
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(root.get("id").in(evidenceIds));

            if (area != null) {
                predicates.add(cb.equal(act.get("accreditationArea"), area));
            }
            if (academicYear != null) {
                predicates.add(cb.equal(act.get("academicYear"), academicYear));
            }
            if (department != null) {
                predicates.add(cb.equal(act.get("department"), department));
            }
            if (keyword != null) {
                String kw = "%" + keyword.toLowerCase() + "%";
                List<Predicate> kwOr = new ArrayList<>();
                kwOr.add(cb.like(cb.lower(root.get("originalFileName")), kw));
                kwOr.add(cb.like(cb.lower(act.get("activityName")), kw));
                kwOr.add(cb.and(cb.isNotNull(root.get("tags")), cb.like(cb.lower(root.get("tags")), kw)));
                kwOr.add(cb.and(cb.isNotNull(root.get("notes")), cb.like(cb.lower(root.get("notes")), kw)));
                predicates.add(cb.or(kwOr.toArray(new Predicate[0])));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Map<UUID, Long> fetchCounts(List<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        return referenceRepository.countByEvidenceIdIn(ids).stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (Long) row[1]
                ));
    }

    private Map<UUID, List<String>> fetchReferencingOffices(List<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        return referenceRepository.findReferencingOfficesByEvidenceIdIn(ids).stream()
                .collect(Collectors.groupingBy(
                        row -> (UUID) row[0],
                        Collectors.mapping(row -> (String) row[1],
                                Collectors.collectingAndThen(Collectors.toList(), values -> values.stream()
                                        .filter(Objects::nonNull)
                                        .filter(v -> !v.isBlank())
                                        .distinct()
                                        .toList()))
                ));
    }

    private SharedEvidenceResponse toSharedResponse(Evidence e, long refCount, List<String> referencingOffices) {
        Activity activity = e.getActivity();
        User uploader = e.getUploadedBy();
        List<String> tags = parseStrings(e.getTags());
        String uploaderDept = uploader == null ? null : uploader.getOffice();

        return new SharedEvidenceResponse(
                e.getId(),
                activity.getId(),
                activity.getActivityName(),
                e.getOriginalFileName(),
                e.getLinkUrl(),
                e.getFileType(),
                e.getFileSize(),
                activity.getAccreditationArea(),
                activity.getAcademicYear(),
                activity.getDepartment() != null ? activity.getDepartment().name() : null,
                activity.getOffice(),
                e.getEvidenceType(),
                tags,
                e.getNotes(),
                uploader == null ? null : uploader.getName(),
                uploaderDept,
                e.getUploadedAt(),
                refCount,
                referencingOffices
        );
    }

    private ReferenceResponse toReferenceResponse(EvidenceReference r) {
        User referencedBy = r.getReferencedBy();
        String refByDept = referencedBy == null ? null : referencedBy.getOffice();
        return new ReferenceResponse(
                r.getId(),
                r.getEvidence().getId(),
                r.getEvidence().getOriginalFileName(),
                r.getActivity().getId(),
                r.getActivity().getActivityName(),
                r.getAccreditationArea(),
                r.getReferencedByOffice(),
                referencedBy == null ? null : referencedBy.getName(),
                refByDept,
                r.getCreatedAt(),
                r.getNote()
        );
    }

    private ActivityReferencedEvidenceResponse toActivityReferencedEvidenceResponse(EvidenceReference r) {
        Evidence evidence = r.getEvidence();
        Activity sourceActivity = evidence.getActivity();
        String sourceOffice = firstNonBlank(
                sourceActivity.getOffice(),
                sourceActivity.getDepartment() != null ? sourceActivity.getDepartment().name() : null
        );
        return new ActivityReferencedEvidenceResponse(
                r.getId(),
                evidence.getId(),
                evidence.getOriginalFileName(),
                evidence.getLinkUrl(),
                evidence.getFileType(),
                evidence.getFileSize(),
                evidence.getEvidenceType(),
                sourceActivity.getId(),
                sourceActivity.getActivityName(),
                sourceOffice,
                sourceActivity.getAccreditationArea(),
                sourceActivity.getAcademicYear(),
                r.getReferencedByOffice(),
                r.getReferencedBy() == null ? null : r.getReferencedBy().getName(),
                r.getCreatedAt(),
                r.getNote()
        );
    }

    private String resolveReferenceOffice(String requestedOffice, User user, Activity targetActivity) {
        String requested = trimToNull(requestedOffice);
        if (requested != null) return requested;
        String actOffice = targetActivity.getOffice();
        String actDept = targetActivity.getDepartment() != null ? targetActivity.getDepartment().name() : null;
        return firstNonBlank(user.getOffice(), actOffice, actDept, "Institutional User");
    }

    private Department tryParseDepartment(String value) {
        if (value == null) return null;
        try { return Department.valueOf(value.trim()); } catch (IllegalArgumentException e) { return null; }
    }

    private Office tryParseOffice(String value) {
        if (value == null) return null;
        try { return Office.valueOf(value.trim()); } catch (IllegalArgumentException e) { return null; }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private List<String> parseStrings(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}

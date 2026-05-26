package com.aercs.service;

import com.aercs.dto.request.ReferenceRequest;
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

    @Transactional(readOnly = true)
    public Page<SharedEvidenceResponse> searchEvidence(
            AccreditationArea area,
            String academicYear,
            String department,
            String keyword,
            Pageable pageable
    ) {
        Specification<Evidence> spec = buildSearchSpec(
                area,
                blankToNull(academicYear),
                blankToNull(department),
                blankToNull(keyword)
        );
        Pageable sorted = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "uploadedAt")
        );
        Page<Evidence> page = evidenceRepository.findAll(spec, sorted);

        List<UUID> ids = page.getContent().stream().map(Evidence::getId).toList();
        Map<UUID, Long> counts = fetchCounts(ids);

        return page.map(e -> toSharedResponse(e, counts.getOrDefault(e.getId(), 0L)));
    }

    @Transactional
    public ReferenceResponse createReference(UUID evidenceId, ReferenceRequest request, UUID currentUserId) {
        Evidence evidence = evidenceRepository.findById(evidenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Evidence file not found"));

        if (evidence.getUploadedBy() != null && evidence.getUploadedBy().getId().equals(currentUserId)) {
            throw new BadRequestException("You cannot reference your own uploaded file");
        }

        Activity activity = activityRepository.findById(request.activityId())
                .orElseThrow(() -> new ResourceNotFoundException("Activity not found"));

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
        ref.setAccreditationArea(area);
        ref.setNote(trimToNull(request.note()));

        // TODO: notify the original uploader when their evidence is referenced (notifications phase)

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

        return referenceRepository.findByEvidenceIdFiltered(
                evidenceId,
                blankToNull(department),
                area,
                startDate,
                endDate,
                pageable
        ).map(this::toReferenceResponse);
    }

    @Transactional
    public void deleteReference(UUID referenceId, UUID currentUserId, UserRole currentUserRole) {
        EvidenceReference ref = referenceRepository.findById(referenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Reference not found"));

        boolean isOwner = ref.getReferencedBy().getId().equals(currentUserId);
        boolean isAdmin = currentUserRole == UserRole.ADMIN;

        if (!isOwner && !isAdmin) {
            throw new BadRequestException("Only the user who created this reference or an administrator can delete it");
        }

        referenceRepository.delete(ref);
    }

    @Transactional(readOnly = true)
    public Page<RepositoryEvidenceResponse> searchRepository(
            String keyword,
            List<AccreditationArea> areas,
            String department,
            String academicYear,
            List<ActivityType> activityTypes,
            List<String> fileTypes,
            LocalDate dateFrom,
            LocalDate dateTo,
            Pageable pageable
    ) {
        Specification<Evidence> spec = buildRepositorySpec(
                blankToNull(keyword), areas, blankToNull(department),
                blankToNull(academicYear), activityTypes, fileTypes, dateFrom, dateTo
        );
        Pageable sorted = PageRequest.of(
                pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "uploadedAt")
        );
        Page<Evidence> page = evidenceRepository.findAll(spec, sorted);
        List<UUID> ids = page.getContent().stream().map(Evidence::getId).toList();
        Map<UUID, Long> counts = fetchCounts(ids);
        return page.map(e -> toRepositoryResponse(e, counts.getOrDefault(e.getId(), 0L)));
    }

    private Specification<Evidence> buildRepositorySpec(
            String keyword,
            List<AccreditationArea> areas,
            String department,
            String academicYear,
            List<ActivityType> activityTypes,
            List<String> fileTypes,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        return (root, query, cb) -> {
            Join<Evidence, Activity> act = root.join("activity", JoinType.INNER);
            List<Predicate> predicates = new ArrayList<>();

            if (areas != null && !areas.isEmpty()) {
                predicates.add(act.get("accreditationArea").in(areas));
            }
            if (department != null) {
                predicates.add(cb.or(
                        cb.equal(act.get("department"), department),
                        cb.equal(act.get("office"), department)
                ));
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

    private RepositoryEvidenceResponse toRepositoryResponse(Evidence e, long refCount) {
        Activity activity = e.getActivity();
        User uploader = e.getUploadedBy();
        return new RepositoryEvidenceResponse(
                e.getId(),
                activity.getId(),
                activity.getActivityName(),
                activity.getActivityType(),
                e.getOriginalFileName(),
                e.getFileType(),
                e.getFileSize(),
                activity.getAccreditationArea(),
                activity.getAcademicYear(),
                activity.getDepartment(),
                activity.getOffice(),
                uploader == null ? null : uploader.getName(),
                e.getUploadedAt(),
                refCount
        );
    }

    private Specification<Evidence> buildSearchSpec(
            AccreditationArea area,
            String academicYear,
            String department,
            String keyword
    ) {
        return (root, query, cb) -> {
            Join<Evidence, Activity> act = root.join("activity", JoinType.INNER);
            List<Predicate> predicates = new ArrayList<>();

            if (area != null) {
                predicates.add(cb.equal(act.get("accreditationArea"), area));
            }
            if (academicYear != null) {
                predicates.add(cb.equal(act.get("academicYear"), academicYear));
            }
            if (department != null) {
                predicates.add(cb.or(
                        cb.equal(act.get("department"), department),
                        cb.equal(act.get("office"), department)
                ));
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

    private SharedEvidenceResponse toSharedResponse(Evidence e, long refCount) {
        Activity activity = e.getActivity();
        User uploader = e.getUploadedBy();
        List<String> tags = parseStrings(e.getTags());

        return new SharedEvidenceResponse(
                e.getId(),
                activity.getId(),
                activity.getActivityName(),
                e.getOriginalFileName(),
                e.getFileType(),
                e.getFileSize(),
                activity.getAccreditationArea(),
                activity.getAcademicYear(),
                activity.getDepartment(),
                activity.getOffice(),
                e.getEvidenceType(),
                tags,
                e.getNotes(),
                uploader == null ? null : uploader.getName(),
                uploader == null ? null : uploader.getDepartment(),
                e.getUploadedAt(),
                refCount
        );
    }

    private ReferenceResponse toReferenceResponse(EvidenceReference r) {
        return new ReferenceResponse(
                r.getId(),
                r.getEvidence().getId(),
                r.getEvidence().getOriginalFileName(),
                r.getActivity().getId(),
                r.getActivity().getActivityName(),
                r.getAccreditationArea(),
                r.getReferencedBy().getName(),
                r.getReferencedBy().getDepartment(),
                r.getCreatedAt(),
                r.getNote()
        );
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

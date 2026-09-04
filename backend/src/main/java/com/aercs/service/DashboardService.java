package com.aercs.service;

import com.aercs.dto.response.DashboardAccreditorAccessItem;
import com.aercs.dto.response.DashboardActivityItem;
import com.aercs.dto.response.DashboardEvidenceItem;
import com.aercs.dto.response.DashboardOverview;
import com.aercs.dto.response.DashboardSummaryResponse;
import com.aercs.entity.AccreditorAccess;
import com.aercs.entity.Activity;
import com.aercs.entity.Department;
import com.aercs.entity.Evidence;
import com.aercs.entity.Office;
import com.aercs.entity.RelatedOffice;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.AccreditorAccessRepository;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceReferenceRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final int LIST_LIMIT = 5;

    private final UserRepository userRepository;
    private final ActivityRepository activityRepository;
    private final EvidenceRepository evidenceRepository;
    private final EvidenceReferenceRepository evidenceReferenceRepository;
    private final AccreditorAccessRepository accreditorAccessRepository;

    // Same office/department -> RelatedOffice mapping as SharedEvidenceService, used here
    // to decide which other departments' evidence is "recommended" to this viewer.
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
    public DashboardSummaryResponse getSummary(String userId, String frontendOrigin) {
        User user = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        boolean canViewAll = canViewAll(user.getRole());
        Department scopeDepartment = canViewAll ? null : user.resolveDepartment();

        List<Activity> activities = canViewAll
                ? activityRepository.findAll()
                : scopeDepartment == null ? List.of() : activityRepository.findByDepartment(scopeDepartment);

        List<UUID> activityIds = activities.stream().map(Activity::getId).toList();

        List<Evidence> evidence = canViewAll
                ? evidenceRepository.findAll()
                : activityIds.isEmpty() ? List.<Evidence>of() : evidenceRepository.findByActivityIdIn(activityIds);

        Map<UUID, List<Evidence>> evidenceByActivity = evidence.stream()
                .collect(Collectors.groupingBy(e -> e.getActivity().getId()));

        List<Evidence> missingMetadata = evidence.stream()
                .filter(e -> !hasMetadata(e))
                .sorted(Comparator.comparing(Evidence::getUploadedAt).reversed())
                .toList();

        List<Activity> noEvidenceActivities = activities.stream()
                .filter(a -> !evidenceByActivity.containsKey(a.getId()))
                .sorted(Comparator.comparing(Activity::getCreatedAt).reversed())
                .toList();

        List<Activity> missingMetadataActivities = activities.stream()
                .filter(a -> evidenceByActivity.getOrDefault(a.getId(), List.of()).stream().anyMatch(e -> !hasMetadata(e)))
                .sorted(Comparator.comparing(Activity::getCreatedAt).reversed())
                .toList();

        List<Activity> recentActivities = activities.stream()
                .sorted(Comparator.comparing(Activity::getCreatedAt).reversed())
                .toList();

        Map<UUID, Long> referenceCounts = fetchReferenceCounts(evidence.stream().map(Evidence::getId).toList());

        List<Evidence> mostReferenced = evidence.stream()
                .filter(e -> referenceCounts.getOrDefault(e.getId(), 0L) > 0)
                .sorted(Comparator.comparing((Evidence e) -> referenceCounts.getOrDefault(e.getId(), 0L)).reversed())
                .toList();

        List<Evidence> recommended = buildRecommendedEvidence(user);
        Map<UUID, Long> recommendedRefCounts = fetchReferenceCounts(recommended.stream().map(Evidence::getId).toList());

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime soon = now.plusDays(7);
        List<AccreditorAccess> expiring = canViewAll
                ? accreditorAccessRepository.findByActiveTrueAndExpiresAtBetween(now, soon)
                : accreditorAccessRepository.findByActiveTrueAndExpiresAtBetweenAndCreatedById(now, soon, user.getId());
        expiring = expiring.stream().sorted(Comparator.comparing(AccreditorAccess::getExpiresAt)).toList();

        String origin = normalizeFrontendOrigin(frontendOrigin);

        DashboardOverview overview = new DashboardOverview(
                activities.size(),
                evidence.size(),
                missingMetadata.size(),
                expiring.size()
        );

        return new DashboardSummaryResponse(
                overview,
                limit(mostReferenced).stream().map(e -> toEvidenceItem(e, referenceCounts)).toList(),
                limit(recommended).stream().map(e -> toEvidenceItem(e, recommendedRefCounts)).toList(),
                limit(recentActivities).stream().map(a -> toActivityItem(a, evidenceByActivity)).toList(),
                limit(noEvidenceActivities).stream().map(a -> toActivityItem(a, evidenceByActivity)).toList(),
                limit(missingMetadataActivities).stream().map(a -> toActivityItem(a, evidenceByActivity)).toList(),
                limit(missingMetadata).stream().map(e -> toEvidenceItem(e, referenceCounts)).toList(),
                limit(expiring).stream().map(a -> toAccessItem(a, origin)).toList()
        );
    }

    private List<Evidence> buildRecommendedEvidence(User user) {
        Department department = user.resolveDepartment();
        Office office = user.resolveOffice();
        RelatedOffice viewerRelated = department != null ? DEPARTMENT_TO_RELATED.get(department)
                : office != null ? OFFICE_TO_RELATED.get(office) : null;
        if (viewerRelated == null) return List.of();

        return evidenceRepository.findAll().stream()
                .filter(e -> e.getRelatedOffices() != null && e.getRelatedOffices().contains(viewerRelated.name()))
                .filter(e -> department == null || e.getActivity().getDepartment() != department)
                .sorted(Comparator.comparing(Evidence::getUploadedAt).reversed())
                .toList();
    }

    private Map<UUID, Long> fetchReferenceCounts(List<UUID> evidenceIds) {
        if (evidenceIds.isEmpty()) return Map.of();
        return evidenceReferenceRepository.countByEvidenceIdIn(evidenceIds).stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));
    }

    private <T> List<T> limit(List<T> items) {
        return items.size() > LIST_LIMIT ? items.subList(0, LIST_LIMIT) : items;
    }

    private boolean canViewAll(UserRole role) {
        return role == UserRole.ADMIN
                || role == UserRole.ACCRED_COORDINATOR
                || role == UserRole.INSTITUTIONAL_OFFICE;
    }

    private boolean hasMetadata(Evidence evidence) {
        return evidence.getEvidenceType() != null
                || (evidence.getRelatedOffices() != null && !evidence.getRelatedOffices().isBlank())
                || (evidence.getTags() != null && !evidence.getTags().isBlank())
                || (evidence.getNotes() != null && !evidence.getNotes().isBlank());
    }

    private DashboardEvidenceItem toEvidenceItem(Evidence e, Map<UUID, Long> refCounts) {
        return new DashboardEvidenceItem(
                e.getId(),
                e.getOriginalFileName(),
                e.getActivity().getId(),
                e.getActivity().getActivityName(),
                e.getEvidenceType() != null ? e.getEvidenceType().name() : null,
                refCounts.getOrDefault(e.getId(), 0L),
                e.getUploadedAt()
        );
    }

    private DashboardActivityItem toActivityItem(Activity a, Map<UUID, List<Evidence>> evidenceByActivity) {
        int evidenceCount = evidenceByActivity.getOrDefault(a.getId(), List.of()).size();
        return new DashboardActivityItem(
                a.getId(),
                a.getActivityName(),
                a.getActivityType() != null ? a.getActivityType().name() : null,
                a.getDepartment() != null ? a.getDepartment().name() : null,
                a.getActivityDate(),
                evidenceCount
        );
    }

    private DashboardAccreditorAccessItem toAccessItem(AccreditorAccess access, String origin) {
        Activity activity = access.getActivity();
        return new DashboardAccreditorAccessItem(
                access.getId(),
                access.getToken(),
                origin + "/accreditor-access/" + access.getToken(),
                activity != null ? activity.getId() : null,
                activity != null ? activity.getActivityName() : null,
                access.getExpiresAt()
        );
    }

    private String normalizeFrontendOrigin(String frontendOrigin) {
        if (frontendOrigin == null || frontendOrigin.isBlank()) {
            return "http://localhost:3000";
        }
        return frontendOrigin.replaceAll("/+$", "");
    }
}

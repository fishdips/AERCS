package com.aercs.dto.response;

import java.util.List;

public record DashboardSummaryResponse(
        DashboardOverview overview,
        List<DashboardEvidenceItem> mostReferencedEvidence,
        List<DashboardEvidenceItem> recommendedEvidence,
        List<DashboardActivityItem> recentActivities,
        List<DashboardActivityItem> activitiesWithNoEvidence,
        List<DashboardActivityItem> activitiesWithEvidenceMissingMetadata,
        List<DashboardEvidenceItem> evidenceNeedingMetadata,
        List<DashboardAccreditorAccessItem> expiringAccreditorAccess
) {}

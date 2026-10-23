package com.aercs.dto.response;

public record DashboardOverview(
        long totalActivities,
        long uploadedEvidence,
        long evidenceNeedingMetadata,
        long expiringAccreditorAccess
) {}

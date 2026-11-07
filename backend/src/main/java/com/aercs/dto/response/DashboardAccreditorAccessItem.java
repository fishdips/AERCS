package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DashboardAccreditorAccessItem(
        UUID id,
        String name,
        String accessUrl,
        UUID activityId,
        String activityName,
        OffsetDateTime expiresAt,
        OffsetDateTime createdAt,
        String createdByName,
        boolean active,
        boolean expired,
        int evidenceCount,
        int accreditorCount,
        boolean canEdit
) {}

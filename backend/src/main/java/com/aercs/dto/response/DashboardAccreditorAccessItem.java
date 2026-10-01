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
        String createdByName,
        boolean canEdit
) {}

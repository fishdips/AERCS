package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserNotificationResponse(
        UUID id,
        String type,
        String actorName,
        String actorUnit,
        UUID activityId,
        String activityName,
        UUID evidenceId,
        String evidenceName,
        Integer versionNumber,
        int count,
        OffsetDateTime createdAt,
        boolean read,
        // False once the activity / evidence the notice is about has been deleted.
        boolean activityAvailable,
        boolean evidenceAvailable
) {}

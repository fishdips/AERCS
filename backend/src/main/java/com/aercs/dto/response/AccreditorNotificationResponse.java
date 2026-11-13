package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AccreditorNotificationResponse(
        UUID id,
        // SHARED, EXPIRING_24H or EXPIRING_4H.
        String type,
        OffsetDateTime createdAt,
        boolean read,
        UUID linkId,
        String linkName,
        // Set when the link was made for a whole activity.
        String activityName,
        String sharedByName,
        // The link's current expiry (it may have been extended since the notice was created).
        OffsetDateTime expiresAt
) {}

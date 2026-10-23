package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

// A link as staff see it when managing accreditor access.
public record AccreditorAccessLinkResponse(
        UUID id,
        String name,
        String notes,
        UUID activityId,
        String activityName,
        String createdByName,
        OffsetDateTime createdAt,
        OffsetDateTime expiresAt,
        boolean expired,
        int evidenceCount,
        List<AccreditorSummaryResponse> accreditors,
        boolean canEdit
) {}

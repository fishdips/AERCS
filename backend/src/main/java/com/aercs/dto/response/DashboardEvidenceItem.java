package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DashboardEvidenceItem(
        UUID id,
        String originalFileName,
        UUID activityId,
        String activityName,
        String evidenceType,
        long referenceCount,
        OffsetDateTime uploadedAt
) {}

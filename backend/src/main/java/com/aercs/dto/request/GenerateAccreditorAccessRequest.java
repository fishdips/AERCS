package com.aercs.dto.request;

import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record GenerateAccreditorAccessRequest(
        List<UUID> evidenceIds,
        UUID activityId,
        OffsetDateTime expirationDateTime,
        @Size(max = 500, message = "Notes must be 500 characters or fewer")
        String notes
) {}

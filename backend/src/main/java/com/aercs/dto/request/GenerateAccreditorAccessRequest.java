package com.aercs.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record GenerateAccreditorAccessRequest(
        List<UUID> evidenceIds,
        UUID activityId,
        OffsetDateTime expirationDateTime,
        @NotBlank(message = "Link name is required")
        @Size(max = 150, message = "Link name must be 150 characters or fewer")
        String name,
        @NotEmpty(message = "Select at least one accreditor")
        List<UUID> accreditorIds,
        @Size(max = 500, message = "Notes must be 500 characters or fewer")
        String notes
) {}

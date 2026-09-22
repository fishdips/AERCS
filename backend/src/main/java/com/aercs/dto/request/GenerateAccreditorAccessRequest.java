package com.aercs.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record GenerateAccreditorAccessRequest(
        List<UUID> evidenceIds,
        UUID activityId,
        OffsetDateTime expirationDateTime,
        @NotBlank(message = "Accreditor email is required")
        @Email(message = "Accreditor email must be valid")
        String accreditorEmail,
        @Size(max = 500, message = "Notes must be 500 characters or fewer")
        String notes
) {}

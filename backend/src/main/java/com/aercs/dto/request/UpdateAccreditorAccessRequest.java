package com.aercs.dto.request;

import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

public record UpdateAccreditorAccessRequest(
        @NotNull(message = "Expiration date is required")
        OffsetDateTime expiresAt
) {}

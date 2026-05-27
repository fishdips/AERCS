package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record GenerateAccreditorAccessResponse(
        UUID id,
        String token,
        String accessUrl,
        OffsetDateTime expiresAt,
        int evidenceCount
) {}

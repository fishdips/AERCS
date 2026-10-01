package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record GenerateAccreditorAccessResponse(
        UUID id,
        String name,
        OffsetDateTime expiresAt,
        int evidenceCount,
        int accreditorCount,
        // Accreditors the link was saved for but whose notification email could not be sent.
        List<String> emailFailures
) {}

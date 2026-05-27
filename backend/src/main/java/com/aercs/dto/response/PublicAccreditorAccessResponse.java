package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PublicAccreditorAccessResponse(
        UUID id,
        String notes,
        OffsetDateTime expiresAt,
        List<AccreditorAccessEvidenceResponse> evidence
) {}

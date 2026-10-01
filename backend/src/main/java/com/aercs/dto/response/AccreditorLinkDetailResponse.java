package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AccreditorLinkDetailResponse(
        UUID id,
        String name,
        String notes,
        String sharedBy,
        OffsetDateTime expiresAt,
        List<AccreditorAccessEvidenceResponse> evidence
) {}

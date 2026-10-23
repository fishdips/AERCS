package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

// A link as a logged-in accreditor sees it in their list.
public record AccreditorLinkResponse(
        UUID id,
        String name,
        String notes,
        String sharedBy,
        OffsetDateTime createdAt,
        OffsetDateTime expiresAt,
        int evidenceCount
) {}

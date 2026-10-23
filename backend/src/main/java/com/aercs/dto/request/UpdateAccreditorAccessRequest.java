package com.aercs.dto.request;

import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

// Every field is optional - only the ones present are changed. When accreditorIds is
// present it replaces the link's full set of assigned accreditors.
public record UpdateAccreditorAccessRequest(
        @Size(max = 150, message = "Link name must be 150 characters or fewer")
        String name,
        OffsetDateTime expiresAt,
        List<UUID> accreditorIds
) {}

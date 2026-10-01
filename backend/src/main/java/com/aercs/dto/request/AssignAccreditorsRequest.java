package com.aercs.dto.request;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

// Bulk-adds every listed accreditor to every listed link (existing assignments are kept).
public record AssignAccreditorsRequest(
        @NotEmpty(message = "Select at least one access link")
        List<UUID> accessIds,
        @NotEmpty(message = "Select at least one accreditor")
        List<UUID> accreditorIds
) {}

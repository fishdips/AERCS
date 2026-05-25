package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String name,
        String email,
        String role,
        String department,
        boolean active,
        boolean mustChangePw,
        OffsetDateTime createdAt
) {}

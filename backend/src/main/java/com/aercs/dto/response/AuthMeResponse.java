package com.aercs.dto.response;

import java.util.UUID;

public record AuthMeResponse(
        UUID id,
        String name,
        String role,
        String department,
        String office,
        boolean mustChangePw
) {}

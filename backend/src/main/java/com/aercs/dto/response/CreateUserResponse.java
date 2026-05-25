package com.aercs.dto.response;

import java.util.UUID;

public record CreateUserResponse(
        UUID id,
        String name,
        String email,
        String role,
        String department,
        boolean active,
        boolean mustChangePw,
        String temporaryPassword  
) {}

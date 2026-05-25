package com.aercs.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateRoleRequest(

        @NotNull(message = "Role is required")
        String role
) {}

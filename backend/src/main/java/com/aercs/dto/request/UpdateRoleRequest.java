package com.aercs.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateRoleRequest(

        @NotNull(message = "Role is required")
        String role,

        // Optional. When present (an empty string clears it) the department/office is changed
        // together with the role so the pair is always validated as a whole.
        String office
) {}

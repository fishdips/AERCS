package com.aercs.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record BatchCreateUserRequest(

        @NotEmpty(message = "Add at least one user")
        List<@Valid Invite> users,

        String office,

        @NotNull(message = "Role is required")
        String role
) {
    public record Invite(

            @NotBlank(message = "Full name is required")
            String name,

            @NotBlank(message = "Email is required")
            @Email(message = "Invalid email format")
            String email
    ) {}
}

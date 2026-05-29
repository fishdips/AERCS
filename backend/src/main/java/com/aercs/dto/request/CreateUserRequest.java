package com.aercs.dto.request;

import com.aercs.entity.Department;
import com.aercs.entity.Office;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateUserRequest(

        @NotBlank(message = "Full name is required")
        String name,

        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,

        Department department,

        Office office,

        @NotNull(message = "Role is required")
        String role
) {}

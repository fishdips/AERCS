package com.aercs.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateStatusRequest(

        @NotNull(message = "Active status is required")
        Boolean active
) {}

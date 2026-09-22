package com.aercs.dto.request;

import jakarta.validation.constraints.Pattern;

public record VerifyAccreditorOtpRequest(
        @Pattern(regexp = "\\d{6}", message = "OTP must be 6 digits")
        String code
) {}

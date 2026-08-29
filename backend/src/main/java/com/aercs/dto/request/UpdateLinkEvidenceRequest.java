package com.aercs.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateLinkEvidenceRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must be 255 characters or fewer")
        String title,

        @NotBlank(message = "Link URL is required")
        @Size(max = 1000, message = "Link URL must be 1000 characters or fewer")
        @Pattern(regexp = "^https?://.*$", message = "Link URL must start with http:// or https://")
        String linkUrl
) {}

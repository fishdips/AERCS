package com.aercs.dto.request;

import com.aercs.entity.AccreditationArea;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ReferenceRequest(
        @NotNull(message = "Activity ID is required")
        UUID activityId,

        @Size(max = 100, message = "Referenced by office must be 100 characters or fewer")
        String referencedByOffice,

        AccreditationArea accreditationArea,

        @Size(max = 500, message = "Note must be 500 characters or fewer")
        String note
) {}

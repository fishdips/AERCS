package com.aercs.dto.response;

import com.aercs.entity.AccreditationArea;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ReferenceResponse(
        UUID id,
        UUID evidenceId,
        String originalFileName,
        UUID activityId,
        String activityName,
        AccreditationArea accreditationArea,
        String referencedByName,
        String referencedByDepartment,
        OffsetDateTime createdAt,
        String note
) {}

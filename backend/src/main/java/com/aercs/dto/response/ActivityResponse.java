package com.aercs.dto.response;

import com.aercs.entity.ActivityType;
import com.aercs.entity.AccreditationArea;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record ActivityResponse(
        UUID id,
        String activityName,
        String description,
        ActivityType activityType,
        String customActivityType,
        LocalDate activityDate,
        String department,
        String office,
        AccreditationArea accreditationArea,
        String academicYear,
        UUID createdById,
        String createdByName,
        String createdByRole,
        String createdByOffice,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<String> attachedEvidence
) {}

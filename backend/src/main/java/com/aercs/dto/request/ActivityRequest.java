package com.aercs.dto.request;

import com.aercs.entity.ActivityType;
import com.aercs.entity.AccreditationArea;
import com.aercs.entity.Department;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record ActivityRequest(
        @NotBlank(message = "Activity title is required")
        @Size(max = 150, message = "Activity title must be 150 characters or fewer")
        String activityName,

        String description,

        @NotNull(message = "Activity type is required")
        ActivityType activityType,

        @Size(max = 100, message = "Custom activity type must be 100 characters or fewer")
        String customActivityType,

        @NotNull(message = "Activity date is required")
        @PastOrPresent(message = "Activity date cannot be in the future")
        LocalDate activityDate,

        Department department,

        @Size(max = 100, message = "Office must be 100 characters or fewer")
        String office,

        @NotNull(message = "Accreditation area is required")
        AccreditationArea accreditationArea,

        @NotBlank(message = "Academic year is required")
        @Size(max = 20, message = "Academic year must be 20 characters or fewer")
        String academicYear
) {}

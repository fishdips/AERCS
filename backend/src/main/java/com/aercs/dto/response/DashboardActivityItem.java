package com.aercs.dto.response;

import java.time.LocalDate;
import java.util.UUID;

public record DashboardActivityItem(
        UUID id,
        String activityName,
        String activityType,
        String department,
        LocalDate activityDate,
        long evidenceCount
) {}

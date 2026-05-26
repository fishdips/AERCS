package com.aercs.dto.response;

import com.aercs.entity.AccreditationArea;
import com.aercs.entity.EvidenceType;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record SharedEvidenceResponse(
        UUID id,
        UUID activityId,
        String activityName,
        String originalFileName,
        String fileType,
        long fileSize,
        AccreditationArea accreditationArea,
        String academicYear,
        String department,
        String office,
        EvidenceType evidenceType,
        List<String> tags,
        String notes,
        String uploadedByName,
        String uploadedByDepartment,
        OffsetDateTime uploadedAt,
        long referenceCount
) {}

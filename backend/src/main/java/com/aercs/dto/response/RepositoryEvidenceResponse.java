package com.aercs.dto.response;

import com.aercs.entity.AccreditationArea;
import com.aercs.entity.ActivityType;
import com.aercs.entity.EvidenceType;

import java.time.OffsetDateTime;
import java.util.UUID;

public record RepositoryEvidenceResponse(
        UUID id,
        UUID activityId,
        String activityName,
        ActivityType activityType,
        String originalFileName,
        String linkUrl,
        String fileType,
        long fileSize,
        AccreditationArea accreditationArea,
        String academicYear,
        String department,
        String office,
        EvidenceType evidenceType,
        String uploadedByName,
        OffsetDateTime uploadedAt,
        long referenceCount,
        boolean referencedToViewer
) {}

package com.aercs.dto.response;

import com.aercs.entity.AccreditationArea;
import com.aercs.entity.EvidenceType;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ActivityReferencedEvidenceResponse(
        UUID referenceId,
        UUID evidenceId,
        String originalFileName,
        String fileType,
        long fileSize,
        EvidenceType evidenceType,
        UUID sourceActivityId,
        String sourceActivityName,
        String sourceOffice,
        AccreditationArea accreditationArea,
        String academicYear,
        String referencedByOffice,
        String referencedByName,
        OffsetDateTime referencedAt,
        String note
) {}

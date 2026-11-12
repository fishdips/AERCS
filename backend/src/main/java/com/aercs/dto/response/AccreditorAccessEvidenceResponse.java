package com.aercs.dto.response;

import com.aercs.entity.AccreditationArea;
import com.aercs.entity.EvidenceType;

import java.util.UUID;

public record AccreditorAccessEvidenceResponse(
        UUID id,
        String originalFileName,
        String linkUrl,
        String fileType,
        long fileSize,
        int currentVersion,
        String sourceActivity,
        String ownerOffice,
        AccreditationArea accreditationArea,
        String academicYear,
        EvidenceType evidenceType
) {}

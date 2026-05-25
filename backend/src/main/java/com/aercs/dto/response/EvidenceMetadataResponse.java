package com.aercs.dto.response;

import com.aercs.entity.AccreditationArea;
import com.aercs.entity.EvidenceType;
import com.aercs.entity.RelatedOffice;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record EvidenceMetadataResponse(
        UUID evidenceId,
        UUID activityId,
        String originalFileName,
        AccreditationArea accreditationArea,
        String academicYear,
        EvidenceType evidenceType,
        List<RelatedOffice> relatedOffices,
        List<String> tags,
        String notes,
        OffsetDateTime updatedAt
) {}

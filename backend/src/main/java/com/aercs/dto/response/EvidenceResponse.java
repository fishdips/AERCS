package com.aercs.dto.response;

import com.aercs.entity.AccreditationArea;
import com.aercs.entity.EvidenceType;
import com.aercs.entity.RelatedOffice;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record EvidenceResponse(
        UUID id,
        UUID activityId,
        String originalFileName,
        String storedFileName,
        String fileType,
        long fileSize,
        AccreditationArea accreditationArea,
        String academicYear,
        EvidenceType evidenceType,
        List<RelatedOffice> relatedOffices,
        List<String> tags,
        String notes,
        UUID uploadedById,
        String uploadedByName,
        String uploadedByRole,
        OffsetDateTime uploadedAt,
        OffsetDateTime updatedAt
) {}

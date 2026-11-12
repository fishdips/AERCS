package com.aercs.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record EvidenceVersionResponse(
        UUID id,
        UUID evidenceId,
        int versionNumber,
        boolean isCurrent,
        String originalFileName,
        String fileType,
        long fileSize,
        String fileHash,
        String versionNote,
        UUID uploadedById,
        String uploadedByName,
        OffsetDateTime uploadedAt
) {}


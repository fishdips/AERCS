package com.aercs.dto.request;

import com.aercs.entity.EvidenceType;
import com.aercs.entity.RelatedOffice;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record BatchEvidenceMetadataRequest(
        @NotEmpty(message = "Select at least one evidence file")
        List<UUID> evidenceIds,

        @NotNull(message = "Evidence type is required")
        EvidenceType evidenceType,

        List<RelatedOffice> relatedOffices,

        List<@Size(max = 50, message = "Each tag must be 50 characters or fewer") String> tags,

        @Size(max = 1000, message = "Notes must be 1000 characters or fewer")
        String notes
) {}

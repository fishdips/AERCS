package com.aercs.repository;

import com.aercs.entity.EvidenceVersion;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EvidenceVersionRepository extends JpaRepository<EvidenceVersion, UUID> {

    // The uploader is fetched with the versions so listing history is one query, not one per row.
    @EntityGraph(attributePaths = "uploadedBy")
    List<EvidenceVersion> findByEvidenceIdOrderByVersionNumberDesc(UUID evidenceId);

    Optional<EvidenceVersion> findByIdAndEvidenceId(UUID id, UUID evidenceId);

    boolean existsByEvidenceId(UUID evidenceId);

    long countByEvidenceId(UUID evidenceId);

    // Earliest version holding exactly this content, if any.
    Optional<EvidenceVersion> findFirstByEvidenceIdAndFileHashAndFileSizeOrderByVersionNumberAsc(
            UUID evidenceId, String fileHash, long fileSize);

    @Query("select coalesce(max(v.versionNumber), 0) from EvidenceVersion v where v.evidence.id = :evidenceId")
    int findMaxVersionNumber(@Param("evidenceId") UUID evidenceId);

    boolean existsByFilePath(String filePath);
}

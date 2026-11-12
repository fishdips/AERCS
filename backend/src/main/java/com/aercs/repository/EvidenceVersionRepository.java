package com.aercs.repository;

import com.aercs.entity.EvidenceVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EvidenceVersionRepository extends JpaRepository<EvidenceVersion, UUID> {

    List<EvidenceVersion> findByEvidenceIdOrderByVersionNumberDesc(UUID evidenceId);

    Optional<EvidenceVersion> findByIdAndEvidenceId(UUID id, UUID evidenceId);

    boolean existsByEvidenceId(UUID evidenceId);

    List<EvidenceVersion> findByFileHashIn(java.util.Collection<String> fileHashes);

    boolean existsByFilePath(String filePath);
}


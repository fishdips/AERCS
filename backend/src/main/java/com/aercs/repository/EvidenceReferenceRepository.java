package com.aercs.repository;

import com.aercs.entity.EvidenceReference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EvidenceReferenceRepository extends JpaRepository<EvidenceReference, UUID>,
        JpaSpecificationExecutor<EvidenceReference> {

    boolean existsByEvidenceIdAndActivityId(UUID evidenceId, UUID activityId);

    List<EvidenceReference> findByActivityIdOrderByCreatedAtDesc(UUID activityId);

    Optional<EvidenceReference> findByIdAndActivityId(UUID id, UUID activityId);

    @Query("SELECT r.evidence.id, COUNT(r) FROM EvidenceReference r WHERE r.evidence.id IN :evidenceIds GROUP BY r.evidence.id")
    List<Object[]> countByEvidenceIdIn(@Param("evidenceIds") List<UUID> evidenceIds);

    @Query("SELECT DISTINCT r.evidence.id FROM EvidenceReference r")
    List<UUID> findReferencedEvidenceIds();

    @Query("SELECT r.evidence.id, r.referencedByOffice FROM EvidenceReference r WHERE r.evidence.id IN :evidenceIds")
    List<Object[]> findReferencingOfficesByEvidenceIdIn(@Param("evidenceIds") List<UUID> evidenceIds);
}

package com.aercs.repository;

import com.aercs.entity.EvidenceReference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EvidenceReferenceRepository extends JpaRepository<EvidenceReference, UUID>,
        JpaSpecificationExecutor<EvidenceReference> {

    boolean existsByEvidenceIdAndActivityId(UUID evidenceId, UUID activityId);

    @Query("SELECT r.evidence.id, COUNT(r) FROM EvidenceReference r WHERE r.evidence.id IN :evidenceIds GROUP BY r.evidence.id")
    List<Object[]> countByEvidenceIdIn(@Param("evidenceIds") List<UUID> evidenceIds);
}

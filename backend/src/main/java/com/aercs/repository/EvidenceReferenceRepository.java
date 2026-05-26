package com.aercs.repository;

import com.aercs.entity.AccreditationArea;
import com.aercs.entity.EvidenceReference;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface EvidenceReferenceRepository extends JpaRepository<EvidenceReference, UUID> {

    boolean existsByEvidenceIdAndActivityId(UUID evidenceId, UUID activityId);

    @Query("SELECT r.evidence.id, COUNT(r) FROM EvidenceReference r WHERE r.evidence.id IN :evidenceIds GROUP BY r.evidence.id")
    List<Object[]> countByEvidenceIdIn(@Param("evidenceIds") List<UUID> evidenceIds);

    @Query(value = """
            SELECT r FROM EvidenceReference r
            JOIN FETCH r.referencedBy u
            JOIN FETCH r.activity a
            WHERE r.evidence.id = :evidenceId
            AND (:department IS NULL OR u.department = :department)
            AND (:area IS NULL OR r.accreditationArea = :area)
            AND (:startDate IS NULL OR r.createdAt >= :startDate)
            AND (:endDate IS NULL OR r.createdAt <= :endDate)
            ORDER BY r.createdAt DESC
            """,
            countQuery = """
            SELECT COUNT(r) FROM EvidenceReference r
            JOIN r.referencedBy u
            WHERE r.evidence.id = :evidenceId
            AND (:department IS NULL OR u.department = :department)
            AND (:area IS NULL OR r.accreditationArea = :area)
            AND (:startDate IS NULL OR r.createdAt >= :startDate)
            AND (:endDate IS NULL OR r.createdAt <= :endDate)
            """)
    Page<EvidenceReference> findByEvidenceIdFiltered(
            @Param("evidenceId") UUID evidenceId,
            @Param("department") String department,
            @Param("area") AccreditationArea area,
            @Param("startDate") OffsetDateTime startDate,
            @Param("endDate") OffsetDateTime endDate,
            Pageable pageable
    );
}

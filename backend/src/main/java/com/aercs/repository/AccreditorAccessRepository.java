package com.aercs.repository;

import com.aercs.entity.AccreditorAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccreditorAccessRepository extends JpaRepository<AccreditorAccess, UUID> {

    Optional<AccreditorAccess> findByToken(String token);

    boolean existsByToken(String token);

    List<AccreditorAccess> findByActiveTrueAndExpiresAtBetween(OffsetDateTime from, OffsetDateTime to);

    List<AccreditorAccess> findByActiveTrueAndExpiresAtBetweenAndCreatedById(
            OffsetDateTime from, OffsetDateTime to, UUID createdById);

    List<AccreditorAccess> findAllByOrderByCreatedAtDesc();

    List<AccreditorAccess> findByCreatedByIdOrderByCreatedAtDesc(UUID createdById);

    // Links a staff user may see: their own plus those created by anyone in the same office/department.
    @Query("""
            SELECT a FROM AccreditorAccess a
            WHERE a.createdBy.id = :userId OR a.createdBy.office = :office
            ORDER BY a.createdAt DESC
            """)
    List<AccreditorAccess> findVisibleToOffice(@Param("userId") UUID userId, @Param("office") String office);

    @Query("""
            SELECT a FROM AccreditorAccess a
            WHERE a.active = true AND a.expiresAt BETWEEN :from AND :to
              AND (a.createdBy.id = :userId OR a.createdBy.office = :office)
            """)
    List<AccreditorAccess> findExpiringVisibleToOffice(
            @Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to,
            @Param("userId") UUID userId, @Param("office") String office);

    // Links an accreditor account can currently open: assigned to them, active and not expired.
    @Query("""
            SELECT a FROM AccreditorAccess a JOIN a.accreditors u
            WHERE u.id = :userId AND a.active = true AND a.expiresAt > :now
            ORDER BY a.expiresAt ASC
            """)
    List<AccreditorAccess> findOpenLinksForAccreditor(@Param("userId") UUID userId, @Param("now") OffsetDateTime now);

    // The join table may have been created by Hibernate (ddl-auto) without ON DELETE CASCADE,
    // so assignments are cleared explicitly before an accreditor account is deleted or re-roled.
    @Modifying
    @Query(value = "DELETE FROM accreditor_access_users WHERE user_id = :userId", nativeQuery = true)
    void removeAccreditorFromAllLinks(@Param("userId") UUID userId);
}

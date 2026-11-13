package com.aercs.repository;

import com.aercs.entity.AccreditorNotification;
import com.aercs.entity.AccreditorNotificationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccreditorNotificationRepository extends JpaRepository<AccreditorNotification, UUID> {

    // An accreditor's notices, newest first, for links that are still active and still assigned to
    // them (a removed or deactivated link must not leave notices behind).
    @Query("""
            SELECT n FROM AccreditorNotification n
            JOIN FETCH n.access a
            LEFT JOIN FETCH a.createdBy
            LEFT JOIN FETCH a.activity
            WHERE n.accreditor.id = :accreditorId
              AND a.active = true
              AND EXISTS (SELECT 1 FROM AccreditorAccess x JOIN x.accreditors u
                          WHERE x.id = a.id AND u.id = :accreditorId)
            ORDER BY n.createdAt DESC
            """)
    List<AccreditorNotification> findVisibleForAccreditor(@Param("accreditorId") UUID accreditorId);

    Optional<AccreditorNotification> findByIdAndAccreditorId(UUID id, UUID accreditorId);

    Optional<AccreditorNotification> findFirstByAccreditorIdAndAccessIdAndType(
            UUID accreditorId, UUID accessId, AccreditorNotificationType type);

    boolean existsByAccreditorIdAndAccessIdAndTypeAndExpiresAtSnapshot(
            UUID accreditorId, UUID accessId, AccreditorNotificationType type, OffsetDateTime expiresAtSnapshot);

    @Modifying
    @Query("UPDATE AccreditorNotification n SET n.readAt = :now WHERE n.accreditor.id = :accreditorId AND n.readAt IS NULL")
    int markAllRead(@Param("accreditorId") UUID accreditorId, @Param("now") OffsetDateTime now);
}

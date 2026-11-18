package com.aercs.repository;

import com.aercs.entity.UserNotification;
import com.aercs.entity.UserNotificationType;
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
public interface UserNotificationRepository extends JpaRepository<UserNotification, UUID> {

    List<UserNotification> findTop100ByRecipientIdOrderByCreatedAtDesc(UUID recipientId);

    long countByRecipientIdAndReadAtIsNull(UUID recipientId);

    Optional<UserNotification> findByIdAndRecipientId(UUID id, UUID recipientId);

    // The unread upload notice a new upload can be folded into.
    Optional<UserNotification> findFirstByRecipientIdAndTypeAndActivityIdAndActorIdAndReadAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(
            UUID recipientId, UserNotificationType type, UUID activityId, UUID actorId, OffsetDateTime after);

    @Modifying
    @Query("UPDATE UserNotification n SET n.readAt = :now WHERE n.recipient.id = :recipientId AND n.readAt IS NULL")
    int markAllRead(@Param("recipientId") UUID recipientId, @Param("now") OffsetDateTime now);

    @Modifying
    @Query("DELETE FROM UserNotification n WHERE n.recipient.id = :recipientId AND n.readAt IS NOT NULL AND n.readAt < :cutoff")
    int deleteReadBefore(@Param("recipientId") UUID recipientId, @Param("cutoff") OffsetDateTime cutoff);
}

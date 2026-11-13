package com.aercs.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A notice shown to an accreditor in their notifications section.
 *
 * <p>Expiry notices record the expiry they warned about ({@code expiresAtSnapshot}). That makes them
 * one-per-expiry-per-accreditor (see the unique constraint), and lets a notice be dropped as stale
 * when staff extend the link afterwards. "Shared" notices leave it empty, so being shared the same
 * link again later (after being removed from it) notifies again.
 */
@Entity
@Table(
        name = "accreditor_notifications",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_accreditor_notification_expiry",
                columnNames = {"accreditor_id", "access_id", "type", "expires_at_snapshot"}
        ),
        indexes = @Index(name = "idx_accreditor_notifications_accreditor", columnList = "accreditor_id, created_at")
)
@Getter
@Setter
@NoArgsConstructor
public class AccreditorNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "accreditor_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User accreditor;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "access_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private AccreditorAccess access;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private AccreditorNotificationType type;

    @Column(name = "expires_at_snapshot")
    private OffsetDateTime expiresAtSnapshot;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "read_at")
    private OffsetDateTime readAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}

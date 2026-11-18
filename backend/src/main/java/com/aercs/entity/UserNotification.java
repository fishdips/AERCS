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
 * A notice in a staff member's (department staff, chairperson, institutional staff) Notifications tab.
 *
 * <p>The names are copied in when the notice is written, and the activity / evidence / actor are kept
 * as plain ids with no foreign key. A notice therefore keeps making sense after the evidence or
 * activity it is about is deleted (the page shows it as no longer available) and never blocks that
 * deletion.
 */
@Entity
@Table(
        name = "user_notifications",
        indexes = @Index(name = "idx_user_notifications_recipient", columnList = "recipient_id, created_at")
)
@Getter
@Setter
@NoArgsConstructor
public class UserNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User recipient;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 30)
    private UserNotificationType type;

    // Who did it. Used to fold a burst of uploads by the same person into one notice.
    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_name", length = 150)
    private String actorName;

    // The actor's department / office (raw value, e.g. "CCS"); the web app turns it into a label.
    @Column(name = "actor_unit", length = 100)
    private String actorUnit;

    // Uploaded: the activity that got the evidence. Referenced / removed: the activity that cites it.
    @Column(name = "activity_id")
    private UUID activityId;

    @Column(name = "activity_name", length = 150)
    private String activityName;

    @Column(name = "evidence_id")
    private UUID evidenceId;

    @Column(name = "evidence_name", length = 255)
    private String evidenceName;

    // New-version notices only.
    @Column(name = "version_number")
    private Integer versionNumber;

    // How many files an upload notice stands for (a burst is folded into one notice).
    @Column(name = "item_count", nullable = false)
    private int itemCount = 1;

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

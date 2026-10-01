package com.aercs.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "accreditor_access")
@Getter
@Setter
@NoArgsConstructor
public class AccreditorAccess {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @Column(name = "token", nullable = false, unique = true, length = 128)
    private String token;

    @Column(name = "name", length = 150)
    private String name;

    // Legacy: the address a pre-account link was emailed to. New links are
    // assigned to registered accreditor accounts via `accreditors` instead.
    @Column(name = "accreditor_email", length = 150)
    private String accreditorEmail;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id")
    private Activity activity;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "accreditor_access_evidence",
            joinColumns = @JoinColumn(name = "access_id"),
            inverseJoinColumns = @JoinColumn(name = "evidence_id")
    )
    private Set<Evidence> evidence = new HashSet<>();

    // Registered accreditor accounts (role ACCREDITOR_LINK) that can open this link after logging in.
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "accreditor_access_users",
            joinColumns = @JoinColumn(name = "access_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> accreditors = new HashSet<>();

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}

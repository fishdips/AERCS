package com.aercs.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "email", nullable = false, unique = true, length = 150)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 50)
    private UserRole role;

    // Holds either a Department enum name or an Office enum name (a user belongs
    // to exactly one org unit, never both) — resolveDepartment()/resolveOffice()
    // below tell you which one it is.
    @Column(name = "office", length = 50)
    private String office;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "must_change_pw", nullable = false)
    private boolean mustChangePw = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public Department resolveDepartment() {
        if (office == null) return null;
        try {
            return Department.valueOf(office);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public Office resolveOffice() {
        if (office == null) return null;
        try {
            return Office.valueOf(office);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}

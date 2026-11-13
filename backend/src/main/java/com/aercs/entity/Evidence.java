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
@Table(name = "evidence")
@Getter
@Setter
@NoArgsConstructor
public class Evidence {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id", nullable = false)
    private Activity activity;

    @Column(name = "original_file_name", nullable = false, length = 255)
    private String originalFileName;

    @Column(name = "stored_file_name", length = 255)
    private String storedFileName;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Column(name = "link_url", length = 1000)
    private String linkUrl;

    @Column(name = "file_type", nullable = false, length = 20)
    private String fileType;

    // SHA-256 of the uploaded file's bytes (hex-encoded). Null for LINK evidence,
    // which has no file content. Used to detect the same file being uploaded more
    // than once - across activities, offices and departments - so staff can be
    // pointed to the existing copy instead of duplicating it in storage.
    @Column(name = "file_hash", length = 64)
    private String fileHash;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "current_version", nullable = false, columnDefinition = "INTEGER NOT NULL DEFAULT 1")
    private int currentVersion = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "evidence_type", length = 50)
    private EvidenceType evidenceType;

    @Column(name = "related_offices", columnDefinition = "TEXT")
    private String relatedOffices;

    @Column(name = "tags", columnDefinition = "TEXT")
    private String tags;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // Who last saved the metadata above (type, offices, tags, notes), and when. Kept apart from
    // updated_at, which also moves when a file is replaced or a link is edited. Null until the
    // metadata has been saved at least once, and the user is cleared if that account is deleted.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "metadata_updated_by")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User metadataUpdatedBy;

    @Column(name = "metadata_updated_at")
    private OffsetDateTime metadataUpdatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User uploadedBy;

    @Column(name = "uploaded_at", nullable = false)
    private OffsetDateTime uploadedAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (uploadedAt == null) {
            uploadedAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}

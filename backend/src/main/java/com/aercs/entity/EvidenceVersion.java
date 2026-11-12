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
@Table(
        name = "evidence_versions",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_evidence_version_number",
                columnNames = {"evidence_id", "version_number"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class EvidenceVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evidence_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Evidence evidence;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    @Column(name = "original_file_name", nullable = false, length = 255)
    private String originalFileName;

    @Column(name = "stored_file_name", length = 255)
    private String storedFileName;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Column(name = "file_type", nullable = false, length = 20)
    private String fileType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "file_hash", length = 64)
    private String fileHash;

    @Column(name = "version_note", columnDefinition = "TEXT")
    private String versionNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User uploadedBy;

    @Column(name = "uploaded_at", nullable = false)
    private OffsetDateTime uploadedAt;

    @PrePersist
    protected void onCreate() {
        if (uploadedAt == null) {
            uploadedAt = OffsetDateTime.now();
        }
    }
}


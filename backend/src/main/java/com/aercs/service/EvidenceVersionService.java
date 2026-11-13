package com.aercs.service;

import com.aercs.dto.response.EvidenceVersionResponse;
import com.aercs.entity.Evidence;
import com.aercs.entity.EvidenceVersion;
import com.aercs.entity.User;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.EvidenceVersionRepository;
import com.aercs.util.EvidenceFiles;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * File version history of an evidence record.
 *
 * <p>How it fits together:
 * <ul>
 *   <li>{@code evidence_versions} holds one row per revision and is never edited, only added to
 *       or (for non-active versions) deleted.</li>
 *   <li>The {@code evidence} row mirrors the <em>active</em> version (file name, path, type, size,
 *       hash and {@code current_version}), so reading the active file never needs the history.</li>
 *   <li>Restoring a version just points the evidence row back at it; it does not add a row.</li>
 *   <li>Every operation that changes the history takes a row lock on the evidence record first, so
 *       two people acting at once can't be handed the same version number.</li>
 *   <li>Adding, restoring and deleting versions is logged with who did it.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class EvidenceVersionService {

    private static final Logger log = LoggerFactory.getLogger(EvidenceVersionService.class);
    private static final String INITIAL_NOTE = "Initial upload";

    private final EvidenceRepository evidenceRepository;
    private final EvidenceVersionRepository versionRepository;
    private final SupabaseStorageService storageReader;
    private final TransactionalStorage storage;
    private final EvidenceAccessService accessService;

    @PersistenceContext
    private EntityManager entityManager;

    // ---------------------------------------------------------------- reading

    @Transactional(readOnly = true)
    public List<EvidenceVersionResponse> listVersions(UUID evidenceId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        accessService.assertCanViewEvidence(evidence, userId);
        if (isLink(evidence)) {
            return List.of();
        }

        int currentVersion = Math.max(1, evidence.getCurrentVersion());
        List<EvidenceVersion> versions = versionRepository.findByEvidenceIdOrderByVersionNumberDesc(evidenceId);
        if (versions.isEmpty()) {
            // Evidence uploaded before versioning existed has no history rows yet; show it as v1.
            User uploadedBy = evidence.getUploadedBy();
            return List.of(new EvidenceVersionResponse(
                    evidence.getId(),
                    evidence.getId(),
                    currentVersion,
                    true,
                    evidence.getOriginalFileName(),
                    evidence.getFileType(),
                    evidence.getFileSize(),
                    evidence.getFileHash(),
                    INITIAL_NOTE,
                    uploadedBy == null ? null : uploadedBy.getId(),
                    uploadedBy == null ? null : uploadedBy.getName(),
                    evidence.getUploadedAt()
            ));
        }
        return versions.stream()
                .map(v -> toVersionResponse(evidenceId, v, v.getVersionNumber() == currentVersion))
                .toList();
    }

    @Transactional(readOnly = true)
    public EvidenceService.EvidenceDownload getVersionDownload(UUID evidenceId, UUID versionId, String userId) {
        VersionFile file = resolveVersionFile(evidenceId, versionId, userId);
        byte[] bytes = storageReader.download(file.filePath());
        return new EvidenceService.EvidenceDownload(
                file.originalFileName(),
                file.fileType(),
                bytes.length,
                MediaType.APPLICATION_OCTET_STREAM,
                new ByteArrayResource(bytes)
        );
    }

    @Transactional(readOnly = true)
    public EvidenceService.EvidenceDownload getVersionView(UUID evidenceId, UUID versionId, String userId) {
        VersionFile file = resolveVersionFile(evidenceId, versionId, userId);
        MediaType mediaType = EvidenceFiles.previewMediaType(file.fileType());
        if (mediaType == null) {
            throw new BadRequestException("Preview is not available for this file type. Please download the file.");
        }
        byte[] bytes = storageReader.download(file.filePath());
        return new EvidenceService.EvidenceDownload(
                file.originalFileName(),
                file.fileType(),
                bytes.length,
                mediaType,
                new ByteArrayResource(bytes)
        );
    }

    // ---------------------------------------------------------------- writing

    /** Records v1 for a freshly created evidence row. */
    @Transactional
    public void recordInitialVersion(Evidence saved, User uploadedBy) {
        EvidenceVersion initial = new EvidenceVersion();
        initial.setEvidence(saved);
        initial.setVersionNumber(1);
        copyFileFields(saved, initial);
        initial.setVersionNote(INITIAL_NOTE);
        initial.setUploadedBy(uploadedBy);
        initial.setUploadedAt(saved.getUploadedAt());
        versionRepository.save(initial);
    }

    /**
     * Stores {@code file} as the next version of {@code evidence} and makes it the active one.
     * The previous versions stay in the history. The uploader becomes the record's owner, as a
     * replacement always has.
     */
    @Transactional
    public Evidence addNewVersion(Evidence evidence, MultipartFile file, String fileHash, User uploadedBy, String note) {
        lock(evidence);
        ensureInitialVersionRecorded(evidence);

        Optional<EvidenceVersion> sameContent = versionRepository
                .findFirstByEvidenceIdAndFileHashAndFileSizeOrderByVersionNumberAsc(evidence.getId(), fileHash, file.getSize());
        if (sameContent.isPresent()) {
            int existing = sameContent.get().getVersionNumber();
            if (existing == currentVersionOf(evidence)) {
                throw new BadRequestException("This file has identical content to the current version (v"
                        + existing + "). Upload a modified file to create a new version.");
            }
            throw new BadRequestException("This file has identical content to version v" + existing
                    + ". Use Restore in Version History to switch back to v" + existing + ".");
        }

        int nextVersion = nextVersionNumber(evidence);

        String extension = EvidenceFiles.getExtension(file.getOriginalFilename());
        String storedFileName = UUID.randomUUID() + "." + extension;
        String objectPath = evidence.getActivity().getId() + "/" + storedFileName;
        try {
            storage.upload(objectPath, file.getBytes(), EvidenceFiles.contentTypeFor(extension));
        } catch (IOException e) {
            throw new BadRequestException("Unable to store evidence file");
        }

        OffsetDateTime now = OffsetDateTime.now();
        evidence.setOriginalFileName(EvidenceFiles.cleanFileName(file.getOriginalFilename()));
        evidence.setStoredFileName(storedFileName);
        evidence.setFilePath(objectPath);
        evidence.setLinkUrl(null);
        evidence.setFileType(extension.toUpperCase(Locale.ROOT));
        evidence.setFileSize(file.getSize());
        evidence.setFileHash(fileHash);
        evidence.setCurrentVersion(nextVersion);
        evidence.setUpdatedAt(now);
        if (uploadedBy != null) {
            evidence.setUploadedBy(uploadedBy);
        }
        Evidence saved = evidenceRepository.save(evidence);

        EvidenceVersion version = new EvidenceVersion();
        version.setEvidence(saved);
        version.setVersionNumber(nextVersion);
        copyFileFields(saved, version);
        version.setVersionNote(note);
        version.setUploadedBy(uploadedBy);
        version.setUploadedAt(now);
        versionRepository.save(version);

        log.info("Evidence {} got a new version v{} from user {}", saved.getId(), nextVersion, describe(uploadedBy));
        return saved;
    }

    /**
     * Makes an earlier version the active one again. Nothing is added to the history and the
     * record's owner is left alone: restoring is not the same as uploading.
     */
    @Transactional
    public Evidence restoreVersion(UUID evidenceId, UUID versionId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        accessService.assertCanModify(evidence, userId);
        lock(evidence);
        ensureInitialVersionRecorded(evidence);

        EvidenceVersion target = versionRepository.findByIdAndEvidenceId(versionId, evidenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Evidence version not found"));

        int previous = currentVersionOf(evidence);
        if (target.getVersionNumber() == previous) {
            throw new BadRequestException("Version v" + target.getVersionNumber() + " is already the current version");
        }

        evidence.setOriginalFileName(target.getOriginalFileName());
        evidence.setStoredFileName(target.getStoredFileName());
        evidence.setFilePath(target.getFilePath());
        evidence.setLinkUrl(null);
        evidence.setFileType(target.getFileType());
        evidence.setFileSize(target.getFileSize());
        evidence.setFileHash(target.getFileHash());
        evidence.setCurrentVersion(target.getVersionNumber());
        evidence.setUpdatedAt(OffsetDateTime.now());
        Evidence saved = evidenceRepository.save(evidence);

        log.info("Evidence {} restored from v{} back to v{} by user {}",
                evidenceId, previous, target.getVersionNumber(), userId);
        return saved;
    }

    /** Permanently removes a version that is not the active one. */
    @Transactional
    public void deleteVersion(UUID evidenceId, UUID versionId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        accessService.assertCanModify(evidence, userId);
        lock(evidence);
        ensureInitialVersionRecorded(evidence);

        EvidenceVersion target = versionRepository.findByIdAndEvidenceId(versionId, evidenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Evidence version not found"));

        if (versionRepository.countByEvidenceId(evidenceId) <= 1) {
            throw new BadRequestException("Cannot delete the only version of an evidence file.");
        }
        if (target.getVersionNumber() == currentVersionOf(evidence)) {
            throw new BadRequestException("Cannot delete the currently active version. Restore another version first.");
        }

        String filePath = target.getFilePath();
        int number = target.getVersionNumber();
        versionRepository.delete(target);

        // Only drop the stored file when nothing else still points at it, and only once the
        // database change has committed.
        if (filePath != null && !filePath.isBlank()
                && !versionRepository.existsByFilePath(filePath)
                && !evidenceRepository.existsByFilePath(filePath)) {
            storage.deleteAfterCommit(filePath);
        }

        log.info("Evidence {} version v{} deleted by user {}", evidenceId, number, userId);
    }

    // ---------------------------------------------------------------- helpers

    /** Evidence uploaded before versioning existed has no history rows; give it its v1 first. */
    private void ensureInitialVersionRecorded(Evidence evidence) {
        if (isLink(evidence) || versionRepository.existsByEvidenceId(evidence.getId())) {
            return;
        }
        EvidenceVersion initial = new EvidenceVersion();
        initial.setEvidence(evidence);
        initial.setVersionNumber(currentVersionOf(evidence));
        copyFileFields(evidence, initial);
        initial.setVersionNote(INITIAL_NOTE);
        initial.setUploadedBy(evidence.getUploadedBy());
        initial.setUploadedAt(evidence.getUploadedAt() != null ? evidence.getUploadedAt() : OffsetDateTime.now());
        versionRepository.save(initial);
    }

    // Version numbers only ever go up, even after a version is deleted.
    private int nextVersionNumber(Evidence evidence) {
        return Math.max(currentVersionOf(evidence), versionRepository.findMaxVersionNumber(evidence.getId())) + 1;
    }

    // Takes a row lock and re-reads the record, so the checks and version number that follow see
    // what any concurrent change has committed.
    private void lock(Evidence evidence) {
        entityManager.refresh(evidence, LockModeType.PESSIMISTIC_WRITE);
    }

    private static void copyFileFields(Evidence from, EvidenceVersion to) {
        to.setOriginalFileName(from.getOriginalFileName());
        to.setStoredFileName(from.getStoredFileName());
        to.setFilePath(from.getFilePath());
        to.setFileType(from.getFileType());
        to.setFileSize(from.getFileSize());
        to.setFileHash(from.getFileHash());
    }

    private static int currentVersionOf(Evidence evidence) {
        return Math.max(1, evidence.getCurrentVersion());
    }

    private static boolean isLink(Evidence evidence) {
        return "LINK".equalsIgnoreCase(evidence.getFileType());
    }

    private static String describe(User user) {
        return user == null ? "unknown" : String.valueOf(user.getId());
    }

    private Evidence findEvidence(UUID evidenceId) {
        return evidenceRepository.findById(evidenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Evidence not found"));
    }

    private VersionFile resolveVersionFile(UUID evidenceId, UUID versionId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        accessService.assertCanViewEvidence(evidence, userId);
        if (isLink(evidence)) {
            throw new BadRequestException("Version files are not applicable for link evidence.");
        }
        Optional<EvidenceVersion> version = versionRepository.findByIdAndEvidenceId(versionId, evidenceId);
        if (version.isPresent()) {
            EvidenceVersion v = version.get();
            return new VersionFile(v.getOriginalFileName(), v.getFileType(), v.getFilePath());
        }
        // The synthetic v1 listed for pre-versioning evidence is addressed by the evidence id.
        if (versionId.equals(evidence.getId())) {
            return new VersionFile(evidence.getOriginalFileName(), evidence.getFileType(), evidence.getFilePath());
        }
        throw new ResourceNotFoundException("Evidence version not found");
    }

    private EvidenceVersionResponse toVersionResponse(UUID evidenceId, EvidenceVersion v, boolean isCurrent) {
        User uploadedBy = v.getUploadedBy();
        return new EvidenceVersionResponse(
                v.getId(),
                evidenceId,
                v.getVersionNumber(),
                isCurrent,
                v.getOriginalFileName(),
                v.getFileType(),
                v.getFileSize(),
                v.getFileHash(),
                v.getVersionNote(),
                uploadedBy == null ? null : uploadedBy.getId(),
                uploadedBy == null ? null : uploadedBy.getName(),
                v.getUploadedAt()
        );
    }

    private record VersionFile(String originalFileName, String fileType, String filePath) {}
}

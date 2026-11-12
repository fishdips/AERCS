package com.aercs.service;

import com.aercs.dto.request.BatchEvidenceMetadataRequest;
import com.aercs.dto.request.CreateLinkEvidenceRequest;
import com.aercs.dto.request.EvidenceMetadataRequest;
import com.aercs.dto.request.UpdateLinkEvidenceRequest;
import com.aercs.dto.response.EvidenceMetadataResponse;
import com.aercs.dto.response.EvidenceResponse;
import com.aercs.dto.response.EvidenceVersionResponse;
import com.aercs.entity.Activity;
import com.aercs.entity.Evidence;
import com.aercs.entity.EvidenceVersion;
import com.aercs.entity.RelatedOffice;
import com.aercs.entity.User;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ForbiddenException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.EvidenceVersionRepository;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EvidenceService {

    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "docx", "xlsx", "jpg", "jpeg", "png");

    private final EvidenceRepository evidenceRepository;
    private final EvidenceVersionRepository evidenceVersionRepository;
    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final SupabaseStorageService storageService;
    private final EvidenceAccessService accessService;

    @Transactional
    public List<EvidenceResponse> uploadEvidence(UUID activityId, List<MultipartFile> files, String userId) {
        Activity activity = findActivity(activityId);
        accessService.assertCanAddToActivity(activity, userId);
        if (files == null || files.isEmpty()) {
            throw new BadRequestException("Select at least one evidence file");
        }
        User uploadedBy = userRepository.findByIdentifier(userId).orElse(null);
        return files.stream()
                .map(file -> saveEvidenceFileWithDuplicateCheck(activity, file, uploadedBy))
                .toList();
    }

    // Looks for an existing file with identical content or same filename before saving:
    // 1. If the exact same content (hash + size) already exists in the same activity, reject it.
    // 2. If a file with the same filename already exists in the same activity with modified content,
    //    automatically create a new version (v2, v3, ...) of that evidence record.
    // 3. If the same content exists in another activity/office, save and attach a DuplicateWarning.
    private EvidenceResponse saveEvidenceFileWithDuplicateCheck(Activity activity, MultipartFile file, User uploadedBy) {
        validateFile(file);
        String fileHash = computeFileHash(file);
        String cleanName = cleanFileName(file.getOriginalFilename());

        List<Evidence> sameActivityEvidence = evidenceRepository.findByActivityIdOrderByUploadedAtDesc(activity.getId());
        if (fileHash != null) {
            Evidence sameContentInActivity = sameActivityEvidence.stream()
                    .filter(e -> fileHash.equals(e.getFileHash()) && e.getFileSize() == file.getSize())
                    .findFirst()
                    .orElse(null);
            if (sameContentInActivity != null) {
                throw new BadRequestException("Duplicate file content: \"" + cleanName
                        + "\" has identical content to \"" + sameContentInActivity.getOriginalFileName()
                        + "\" (v" + Math.max(1, sameContentInActivity.getCurrentVersion()) + ") already in this activity.");
            }
        }

        Evidence sameNameInActivity = sameActivityEvidence.stream()
                .filter(e -> !"LINK".equalsIgnoreCase(e.getFileType()))
                .filter(e -> cleanName.equalsIgnoreCase(e.getOriginalFileName()))
                .findFirst()
                .orElse(null);

        // A matching hash only counts if the stored file is the same size too: records whose
        // file was replaced before the hash was kept in sync carry a stale hash and must not
        // be reported as duplicates of a file they no longer hold.
        Evidence existingDuplicate = fileHash == null
                ? null
                : evidenceRepository.findByFileHashOrderByUploadedAtAsc(fileHash).stream()
                        .filter(e -> e.getFileSize() == file.getSize())
                        .filter(e -> sameNameInActivity == null || !e.getId().equals(sameNameInActivity.getId()))
                        .findFirst()
                        .orElse(null);

        Evidence saved;
        if (sameNameInActivity != null) {
            saved = applyNewVersion(
                    sameNameInActivity,
                    file,
                    fileHash,
                    uploadedBy,
                    "Uploaded new version of " + cleanName
            );
        } else {
            saved = saveEvidenceFile(activity, file, uploadedBy, fileHash);
        }

        EvidenceResponse.DuplicateWarning duplicateWarning = existingDuplicate == null ? null
                : new EvidenceResponse.DuplicateWarning(
                        existingDuplicate.getId(),
                        existingDuplicate.getActivity().getId(),
                        existingDuplicate.getOriginalFileName(),
                        existingDuplicate.getActivity().getActivityName(),
                        resolveOwnerOffice(existingDuplicate),
                        existingDuplicate.getUploadedBy() == null ? null : existingDuplicate.getUploadedBy().getName(),
                        existingDuplicate.getUploadedAt()
                );

        return toResponse(saved, duplicateWarning);
    }

    // Best-effort: if hashing fails for some reason, skip the duplicate check
    // rather than block the upload over it.
    private String computeFileHash(MultipartFile file) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(file.getBytes());
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (IOException | NoSuchAlgorithmException e) {
            return null;
        }
    }

    @Transactional
    public EvidenceResponse createLinkEvidence(UUID activityId, CreateLinkEvidenceRequest request, String userId) {
        Activity activity = findActivity(activityId);
        accessService.assertCanAddToActivity(activity, userId);
        User uploadedBy = userRepository.findByIdentifier(userId).orElse(null);

        Evidence evidence = new Evidence();
        evidence.setActivity(activity);
        evidence.setOriginalFileName(trimToNull(request.title()) != null ? request.title().trim() : "Google Drive Link");
        evidence.setStoredFileName(null);
        evidence.setFilePath(null);
        evidence.setLinkUrl(request.linkUrl().trim());
        evidence.setFileType("LINK");
        evidence.setFileSize(0);
        evidence.setUploadedBy(uploadedBy);

        return toResponse(evidenceRepository.save(evidence));
    }

    @Transactional
    public EvidenceResponse updateLinkEvidence(UUID evidenceId, UpdateLinkEvidenceRequest request, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        assertCanModify(evidence, userId);

        evidence.setOriginalFileName(trimToNull(request.title()) != null ? request.title().trim() : "Google Drive Link");
        evidence.setLinkUrl(request.linkUrl().trim());
        evidence.setUpdatedAt(OffsetDateTime.now());

        return toResponse(evidenceRepository.save(evidence));
    }

    @Transactional(readOnly = true)
    public List<EvidenceResponse> listEvidence(UUID activityId, String userId) {
        accessService.assertCanViewActivity(findActivity(activityId), userId);
        return evidenceRepository.findByActivityIdOrderByUploadedAtDesc(activityId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public EvidenceResponse getEvidence(UUID evidenceId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        accessService.assertCanViewEvidence(evidence, userId);
        return toResponse(evidence);
    }

    @Transactional(readOnly = true)
    public EvidenceMetadataResponse getMetadata(UUID evidenceId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        accessService.assertCanViewEvidence(evidence, userId);
        return toMetadataResponse(evidence);
    }

    @Transactional
    public EvidenceMetadataResponse updateMetadata(UUID evidenceId, EvidenceMetadataRequest request, UUID currentUserId) {
        Evidence evidence = findEvidence(evidenceId);
        assertCanModify(evidence, currentUserId);
        applyMetadata(evidence, request.evidenceType(), request.relatedOffices(), request.tags(), request.notes());
        return toMetadataResponse(evidenceRepository.save(evidence));
    }

    @Transactional
    public List<EvidenceMetadataResponse> updateMetadataBatch(BatchEvidenceMetadataRequest request, UUID currentUserId) {
        if (request.evidenceIds() == null || request.evidenceIds().isEmpty()) {
            throw new BadRequestException("Select at least one evidence file");
        }

        List<Evidence> selectedEvidence = request.evidenceIds().stream()
                .distinct()
                .map(this::findEvidence)
                .toList();

        selectedEvidence.forEach(evidence -> assertCanModify(evidence, currentUserId));

        return selectedEvidence.stream()
                .map(evidence -> {
                    applyMetadata(evidence, request.evidenceType(), request.relatedOffices(), request.tags(), request.notes());
                    return evidenceRepository.save(evidence);
                })
                .map(this::toMetadataResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public EvidenceDownload getDownload(UUID evidenceId, String userId) {
        accessService.assertCanViewEvidence(findEvidence(evidenceId), userId);
        return getDownload(evidenceId);
    }

    @Transactional(readOnly = true)
    public EvidenceDownload getView(UUID evidenceId, String userId) {
        accessService.assertCanViewEvidence(findEvidence(evidenceId), userId);
        return getView(evidenceId);
    }

    // Unchecked: callers must have authorised access themselves (e.g. the accreditor link flow).
    @Transactional(readOnly = true)
    public EvidenceDownload getDownload(UUID evidenceId) {
        Evidence evidence = findEvidence(evidenceId);
        if ("LINK".equalsIgnoreCase(evidence.getFileType())) {
            throw new BadRequestException("Download is not applicable for link evidence. Please open the link directly.");
        }
        ActiveVersionSnapshot active = resolveActiveVersionSnapshot(evidence);
        byte[] bytes = storageService.download(active.filePath());
        return new EvidenceDownload(
                active.originalFileName(),
                active.fileType(),
                bytes.length,
                MediaType.APPLICATION_OCTET_STREAM,
                new ByteArrayResource(bytes)
        );
    }

    @Transactional(readOnly = true)
    public EvidenceDownload getView(UUID evidenceId) {
        Evidence evidence = findEvidence(evidenceId);
        if ("LINK".equalsIgnoreCase(evidence.getFileType())) {
            throw new BadRequestException("Preview is not applicable for link evidence. Please open the link directly.");
        }
        ActiveVersionSnapshot active = resolveActiveVersionSnapshot(evidence);
        MediaType mediaType = previewMediaType(active.fileType());
        if (mediaType == null) {
            throw new BadRequestException("Preview is not available for this file type. Please download the file.");
        }
        byte[] bytes = storageService.download(active.filePath());
        return new EvidenceDownload(
                active.originalFileName(),
                active.fileType(),
                bytes.length,
                mediaType,
                new ByteArrayResource(bytes)
        );
    }

    @Transactional(readOnly = true)
    public ActiveVersionSnapshot resolveActiveVersionSnapshot(Evidence evidence) {
        if ("LINK".equalsIgnoreCase(evidence.getFileType())) {
            return new ActiveVersionSnapshot(
                    evidence.getOriginalFileName(),
                    evidence.getFilePath(),
                    evidence.getFileType(),
                    evidence.getFileSize(),
                    Math.max(1, evidence.getCurrentVersion())
            );
        }

        Evidence canonical = findRichestLineageSource(evidence);
        List<EvidenceVersion> versions = evidenceVersionRepository
                .findByEvidenceIdOrderByVersionNumberDesc(canonical.getId()).stream()
                .filter(v -> v.getVersionNote() == null || !v.getVersionNote().startsWith("Restored from v"))
                .toList();

        int targetVer = Math.max(1, canonical.getCurrentVersion());
        if (!versions.isEmpty()) {
            EvidenceVersion active = versions.stream()
                    .filter(v -> v.getVersionNumber() == targetVer)
                    .findFirst()
                    .orElseGet(() -> {
                        // If canonical.currentVersion pointed to a restored duplicate, match by hash/path or take latest
                        if (canonical.getFileHash() != null) {
                            for (int i = versions.size() - 1; i >= 0; i--) {
                                EvidenceVersion v = versions.get(i);
                                if (canonical.getFileHash().equals(v.getFileHash())) {
                                    return v;
                                }
                            }
                        }
                        return versions.get(0);
                    });
            return new ActiveVersionSnapshot(
                    active.getOriginalFileName(),
                    active.getFilePath(),
                    active.getFileType(),
                    active.getFileSize(),
                    active.getVersionNumber()
            );
        }

        return new ActiveVersionSnapshot(
                canonical.getOriginalFileName(),
                canonical.getFilePath(),
                canonical.getFileType(),
                canonical.getFileSize(),
                targetVer
        );
    }

    public record ActiveVersionSnapshot(
            String originalFileName,
            String filePath,
            String fileType,
            long fileSize,
            int currentVersion
    ) {}

    @Transactional
    public EvidenceResponse replaceEvidence(UUID evidenceId, MultipartFile file, String userId) {
        return replaceEvidence(evidenceId, file, null, userId);
    }

    @Transactional
    public EvidenceResponse replaceEvidence(UUID evidenceId, MultipartFile file, String versionNote, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        assertCanModify(evidence, userId);
        validateFile(file);

        String fileHash = computeFileHash(file);
        if (fileHash != null && fileHash.equals(evidence.getFileHash()) && file.getSize() == evidence.getFileSize()) {
            throw new BadRequestException("This file has identical content to the current version (v"
                    + Math.max(1, evidence.getCurrentVersion())
                    + "). Upload a modified file to create a new version.");
        }

        User uploader = userRepository.findByIdentifier(userId).orElse(evidence.getUploadedBy());
        String note = trimToNull(versionNote) != null ? trimToNull(versionNote) : "Replaced file";
        Evidence saved = applyNewVersion(evidence, file, fileHash, uploader, note);
        return toResponse(saved);
    }

    @Transactional
    public List<EvidenceVersionResponse> listVersions(UUID evidenceId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        accessService.assertCanViewEvidence(evidence, userId);
        if ("LINK".equalsIgnoreCase(evidence.getFileType())) {
            return List.of();
        }
        cleanupDuplicateRestoredVersions(evidence);
        reconcileWithSiblingLineage(evidence);
        List<EvidenceVersion> versions = evidenceVersionRepository.findByEvidenceIdOrderByVersionNumberDesc(evidenceId);
        if (versions.isEmpty()) {
            User uploadedBy = evidence.getUploadedBy();
            int ver = Math.max(1, evidence.getCurrentVersion());
            return List.of(new EvidenceVersionResponse(
                    evidence.getId(),
                    evidence.getId(),
                    ver,
                    true,
                    evidence.getOriginalFileName(),
                    evidence.getFileType(),
                    evidence.getFileSize(),
                    evidence.getFileHash(),
                    "Initial upload",
                    uploadedBy == null ? null : uploadedBy.getId(),
                    uploadedBy == null ? null : uploadedBy.getName(),
                    evidence.getUploadedAt()
            ));
        }
        int currentVer = Math.max(1, evidence.getCurrentVersion());
        return versions.stream()
                .map(v -> toVersionResponse(v, v.getVersionNumber() == currentVer))
                .toList();
    }

    @Transactional(readOnly = true)
    public EvidenceDownload getVersionDownload(UUID evidenceId, UUID versionId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        accessService.assertCanViewEvidence(evidence, userId);
        VersionFileTarget target = resolveVersionFileTarget(evidence, versionId);
        byte[] bytes = storageService.download(target.filePath());
        return new EvidenceDownload(
                target.originalFileName(),
                target.fileType(),
                bytes.length,
                MediaType.APPLICATION_OCTET_STREAM,
                new ByteArrayResource(bytes)
        );
    }

    @Transactional(readOnly = true)
    public EvidenceDownload getVersionView(UUID evidenceId, UUID versionId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        accessService.assertCanViewEvidence(evidence, userId);
        VersionFileTarget target = resolveVersionFileTarget(evidence, versionId);
        MediaType mediaType = previewMediaType(target.fileType());
        if (mediaType == null) {
            throw new BadRequestException("Preview is not available for this file type. Please download the file.");
        }
        byte[] bytes = storageService.download(target.filePath());
        return new EvidenceDownload(
                target.originalFileName(),
                target.fileType(),
                bytes.length,
                mediaType,
                new ByteArrayResource(bytes)
        );
    }

    @Transactional
    public EvidenceResponse restoreVersion(UUID evidenceId, UUID versionId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        assertCanModify(evidence, userId);
        ensureInitialVersionRecorded(evidence);
        cleanupDuplicateRestoredVersions(evidence);

        EvidenceVersion target = evidenceVersionRepository.findByIdAndEvidenceId(versionId, evidenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Evidence version not found"));

        if (target.getVersionNumber() == evidence.getCurrentVersion()) {
            throw new BadRequestException("Version v" + target.getVersionNumber() + " is already the current version");
        }

        OffsetDateTime now = OffsetDateTime.now();
        evidence.setOriginalFileName(target.getOriginalFileName());
        evidence.setStoredFileName(target.getStoredFileName());
        evidence.setFilePath(target.getFilePath());
        evidence.setLinkUrl(null);
        evidence.setFileType(target.getFileType());
        evidence.setFileSize(target.getFileSize());
        evidence.setFileHash(target.getFileHash());
        evidence.setCurrentVersion(target.getVersionNumber());
        evidence.setUpdatedAt(now);
        if (target.getUploadedBy() != null) {
            evidence.setUploadedBy(target.getUploadedBy());
        }

        Evidence saved = evidenceRepository.save(evidence);
        syncSiblingEvidenceLineage(saved);
        return toResponse(saved);
    }

    @Transactional
    public void deleteVersion(UUID evidenceId, UUID versionId, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        assertCanModify(evidence, userId);
        ensureInitialVersionRecorded(evidence);
        cleanupDuplicateRestoredVersions(evidence);

        EvidenceVersion target = evidenceVersionRepository.findByIdAndEvidenceId(versionId, evidenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Evidence version not found"));

        List<EvidenceVersion> allVersions = evidenceVersionRepository.findByEvidenceIdOrderByVersionNumberDesc(evidenceId);
        if (allVersions.size() <= 1) {
            throw new BadRequestException("Cannot delete the only version of an evidence file.");
        }
        if (target.getVersionNumber() == evidence.getCurrentVersion()) {
            throw new BadRequestException("Cannot delete the currently active version. Restore another version first.");
        }

        String deletedFilePath = target.getFilePath();
        evidenceVersionRepository.delete(target);
        syncSiblingEvidenceLineage(evidence);

        if (deletedFilePath != null && !deletedFilePath.isBlank()
                && !evidenceVersionRepository.existsByFilePath(deletedFilePath)
                && !evidenceRepository.existsByFilePath(deletedFilePath)) {
            storageService.delete(deletedFilePath);
        }
    }

    private void cleanupDuplicateRestoredVersions(Evidence evidence) {
        List<EvidenceVersion> versions = evidenceVersionRepository.findByEvidenceIdOrderByVersionNumberDesc(evidence.getId());
        if (versions.size() <= 1) {
            return;
        }
        List<EvidenceVersion> ascending = new ArrayList<>(versions);
        Collections.reverse(ascending);

        Map<String, EvidenceVersion> canonicalByContent = new LinkedHashMap<>();
        boolean updatedEvidence = false;

        for (EvidenceVersion v : ascending) {
            String key = (v.getFileHash() != null ? v.getFileHash() : "") + ":" + v.getFileSize() + ":" + Objects.toString(v.getFilePath(), "");
            boolean isRestoredCopy = v.getVersionNote() != null && v.getVersionNote().startsWith("Restored from v");
            EvidenceVersion canonical = canonicalByContent.get(key);

            if (isRestoredCopy && canonical != null) {
                if (evidence.getCurrentVersion() == v.getVersionNumber()) {
                    evidence.setCurrentVersion(canonical.getVersionNumber());
                    evidence.setOriginalFileName(canonical.getOriginalFileName());
                    evidence.setStoredFileName(canonical.getStoredFileName());
                    evidence.setFilePath(canonical.getFilePath());
                    evidence.setFileType(canonical.getFileType());
                    evidence.setFileSize(canonical.getFileSize());
                    evidence.setFileHash(canonical.getFileHash());
                    updatedEvidence = true;
                }
                evidenceVersionRepository.delete(v);
            } else {
                canonicalByContent.putIfAbsent(key, v);
            }
        }

        if (updatedEvidence) {
            evidenceRepository.save(evidence);
        }
    }

    @Transactional
    public void deleteEvidence(UUID evidenceId, UUID currentUserId) {
        Evidence evidence = findEvidence(evidenceId);
        assertCanModify(evidence, currentUserId);
        Set<String> objectPaths = new LinkedHashSet<>();
        if (evidence.getFilePath() != null && !evidence.getFilePath().isBlank()) {
            objectPaths.add(evidence.getFilePath());
        }
        evidenceVersionRepository.findByEvidenceIdOrderByVersionNumberDesc(evidenceId).stream()
                .map(EvidenceVersion::getFilePath)
                .filter(p -> p != null && !p.isBlank())
                .forEach(objectPaths::add);
        evidenceRepository.delete(evidence);
        for (String path : objectPaths) {
            if (!evidenceVersionRepository.existsByFilePath(path)
                    && !evidenceRepository.existsByFilePath(path)) {
                storageService.delete(path);
            }
        }
    }

    private Evidence saveEvidenceFile(Activity activity, MultipartFile file, User uploadedBy, String fileHash) {
        validateFile(file);
        String extension = getExtension(file.getOriginalFilename());
        String storedFileName = UUID.randomUUID() + "." + extension;
        String objectPath = activity.getId() + "/" + storedFileName;

        try {
            storageService.upload(objectPath, file.getBytes(), contentTypeFor(extension));
        } catch (IOException e) {
            throw new BadRequestException("Unable to store evidence file");
        }

        Evidence evidence = new Evidence();
        evidence.setActivity(activity);
        evidence.setOriginalFileName(cleanFileName(file.getOriginalFilename()));
        evidence.setStoredFileName(storedFileName);
        evidence.setFilePath(objectPath);
        evidence.setFileType(extension.toUpperCase(Locale.ROOT));
        evidence.setFileSize(file.getSize());
        evidence.setCurrentVersion(1);
        evidence.setFileHash(fileHash);
        evidence.setUploadedBy(uploadedBy);
        Evidence saved = evidenceRepository.save(evidence);

        EvidenceVersion initialVersion = new EvidenceVersion();
        initialVersion.setEvidence(saved);
        initialVersion.setVersionNumber(1);
        initialVersion.setOriginalFileName(saved.getOriginalFileName());
        initialVersion.setStoredFileName(saved.getStoredFileName());
        initialVersion.setFilePath(saved.getFilePath());
        initialVersion.setFileType(saved.getFileType());
        initialVersion.setFileSize(saved.getFileSize());
        initialVersion.setFileHash(saved.getFileHash());
        initialVersion.setVersionNote("Initial upload");
        initialVersion.setUploadedBy(uploadedBy);
        initialVersion.setUploadedAt(saved.getUploadedAt());
        evidenceVersionRepository.save(initialVersion);

        return saved;
    }

    private Evidence applyNewVersion(
            Evidence evidence,
            MultipartFile file,
            String fileHash,
            User uploadedBy,
            String versionNote
    ) {
        ensureInitialVersionRecorded(evidence);
        cleanupDuplicateRestoredVersions(evidence);

        if (fileHash != null) {
            Optional<EvidenceVersion> matchingVersion = evidenceVersionRepository
                    .findByEvidenceIdOrderByVersionNumberDesc(evidence.getId()).stream()
                    .filter(v -> fileHash.equals(v.getFileHash()) && file.getSize() == v.getFileSize())
                    .findFirst();
            if (matchingVersion.isPresent()) {
                int ver = matchingVersion.get().getVersionNumber();
                throw new BadRequestException("This file has identical content to version v" + ver
                        + ". Use Restore in Version History to switch back to v" + ver + ".");
            }
        }

        int nextVersion = nextVersionNumber(evidence);

        String extension = getExtension(file.getOriginalFilename());
        String storedFileName = UUID.randomUUID() + "." + extension;
        String objectPath = evidence.getActivity().getId() + "/" + storedFileName;

        try {
            storageService.upload(objectPath, file.getBytes(), contentTypeFor(extension));
        } catch (IOException e) {
            throw new BadRequestException("Unable to store evidence file");
        }

        OffsetDateTime now = OffsetDateTime.now();
        evidence.setOriginalFileName(cleanFileName(file.getOriginalFilename()));
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

        EvidenceVersion newVersion = new EvidenceVersion();
        newVersion.setEvidence(saved);
        newVersion.setVersionNumber(nextVersion);
        newVersion.setOriginalFileName(saved.getOriginalFileName());
        newVersion.setStoredFileName(saved.getStoredFileName());
        newVersion.setFilePath(saved.getFilePath());
        newVersion.setFileType(saved.getFileType());
        newVersion.setFileSize(saved.getFileSize());
        newVersion.setFileHash(saved.getFileHash());
        newVersion.setVersionNote(versionNote);
        newVersion.setUploadedBy(uploadedBy);
        newVersion.setUploadedAt(now);
        evidenceVersionRepository.save(newVersion);
        syncSiblingEvidenceLineage(saved);

        return saved;
    }

    private Evidence findRichestLineageSource(Evidence evidence) {
        Set<String> hashes = collectLineageHashes(evidence);
        if (hashes.isEmpty()) {
            return evidence;
        }
        List<EvidenceVersion> ownVersions = evidenceVersionRepository.findByEvidenceIdOrderByVersionNumberDesc(evidence.getId());
        int bestCount = (int) ownVersions.stream()
                .filter(v -> v.getVersionNote() == null || !v.getVersionNote().startsWith("Restored from v"))
                .count();
        Evidence best = evidence;

        for (Evidence sibling : findSiblingEvidence(evidence, hashes)) {
            List<EvidenceVersion> sibVersions = evidenceVersionRepository.findByEvidenceIdOrderByVersionNumberDesc(sibling.getId());
            int sibCount = (int) sibVersions.stream()
                    .filter(v -> v.getVersionNote() == null || !v.getVersionNote().startsWith("Restored from v"))
                    .count();
            if (sibCount > bestCount || (sibCount == bestCount && sibCount > 0
                    && sibling.getUpdatedAt() != null && best.getUpdatedAt() != null
                    && sibling.getUpdatedAt().isAfter(best.getUpdatedAt()))) {
                bestCount = sibCount;
                best = sibling;
            }
        }
        return best;
    }

    private void reconcileWithSiblingLineage(Evidence evidence) {
        Evidence source = findRichestLineageSource(evidence);
        if (!source.getId().equals(evidence.getId())) {
            cleanupDuplicateRestoredVersions(source);
            copyLineageFromSource(source, evidence);
        }
    }

    private void syncSiblingEvidenceLineage(Evidence source) {
        if ("LINK".equalsIgnoreCase(source.getFileType())) {
            return;
        }
        Set<String> hashes = collectLineageHashes(source);
        if (hashes.isEmpty()) {
            return;
        }
        for (Evidence sibling : findSiblingEvidence(source, hashes)) {
            copyLineageFromSource(source, sibling);
        }
    }

    private Set<String> collectLineageHashes(Evidence evidence) {
        Set<String> hashes = new LinkedHashSet<>();
        if (evidence.getFileHash() != null && !evidence.getFileHash().isBlank()) {
            hashes.add(evidence.getFileHash());
        }
        evidenceVersionRepository.findByEvidenceIdOrderByVersionNumberDesc(evidence.getId()).stream()
                .map(EvidenceVersion::getFileHash)
                .filter(h -> h != null && !h.isBlank())
                .forEach(hashes::add);
        return hashes;
    }

    private List<Evidence> findSiblingEvidence(Evidence self, Set<String> hashes) {
        if (hashes.isEmpty()) {
            return List.of();
        }
        Map<UUID, Evidence> siblings = new LinkedHashMap<>();
        evidenceRepository.findByFileHashIn(hashes).forEach(e -> {
            if (!e.getId().equals(self.getId()) && !"LINK".equalsIgnoreCase(e.getFileType())) {
                siblings.put(e.getId(), e);
            }
        });
        evidenceVersionRepository.findByFileHashIn(hashes).forEach(v -> {
            Evidence e = v.getEvidence();
            if (e != null && !e.getId().equals(self.getId()) && !"LINK".equalsIgnoreCase(e.getFileType())) {
                siblings.put(e.getId(), e);
            }
        });
        return new ArrayList<>(siblings.values());
    }

    private void copyLineageFromSource(Evidence source, Evidence target) {
        List<EvidenceVersion> sourceVersions = evidenceVersionRepository
                .findByEvidenceIdOrderByVersionNumberDesc(source.getId());
        List<EvidenceVersion> targetVersions = evidenceVersionRepository
                .findByEvidenceIdOrderByVersionNumberDesc(target.getId());

        Set<Integer> sourceVerNums = new LinkedHashSet<>();
        Map<Integer, EvidenceVersion> targetByNum = new LinkedHashMap<>();
        for (EvidenceVersion tv : targetVersions) {
            targetByNum.put(tv.getVersionNumber(), tv);
        }

        List<EvidenceVersion> ascendingSource = new ArrayList<>(sourceVersions);
        Collections.reverse(ascendingSource);
        for (EvidenceVersion sv : ascendingSource) {
            sourceVerNums.add(sv.getVersionNumber());
            EvidenceVersion tv = targetByNum.get(sv.getVersionNumber());
            if (tv == null) {
                tv = new EvidenceVersion();
                tv.setEvidence(target);
                tv.setVersionNumber(sv.getVersionNumber());
            }
            tv.setOriginalFileName(sv.getOriginalFileName());
            tv.setStoredFileName(sv.getStoredFileName());
            tv.setFilePath(sv.getFilePath());
            tv.setFileType(sv.getFileType());
            tv.setFileSize(sv.getFileSize());
            tv.setFileHash(sv.getFileHash());
            tv.setVersionNote(sv.getVersionNote());
            tv.setUploadedBy(sv.getUploadedBy());
            tv.setUploadedAt(sv.getUploadedAt());
            evidenceVersionRepository.save(tv);
        }

        for (EvidenceVersion tv : targetVersions) {
            if (!sourceVerNums.contains(tv.getVersionNumber())) {
                evidenceVersionRepository.delete(tv);
            }
        }

        target.setOriginalFileName(source.getOriginalFileName());
        target.setStoredFileName(source.getStoredFileName());
        target.setFilePath(source.getFilePath());
        target.setFileType(source.getFileType());
        target.setFileSize(source.getFileSize());
        target.setFileHash(source.getFileHash());
        target.setCurrentVersion(source.getCurrentVersion());
        target.setUpdatedAt(source.getUpdatedAt());
        evidenceRepository.save(target);
    }

    private void ensureInitialVersionRecorded(Evidence evidence) {
        if ("LINK".equalsIgnoreCase(evidence.getFileType())) {
            return;
        }
        if (evidenceVersionRepository.existsByEvidenceId(evidence.getId())) {
            return;
        }
        EvidenceVersion initial = new EvidenceVersion();
        initial.setEvidence(evidence);
        initial.setVersionNumber(Math.max(1, evidence.getCurrentVersion()));
        initial.setOriginalFileName(evidence.getOriginalFileName());
        initial.setStoredFileName(evidence.getStoredFileName());
        initial.setFilePath(evidence.getFilePath());
        initial.setFileType(evidence.getFileType());
        initial.setFileSize(evidence.getFileSize());
        initial.setFileHash(evidence.getFileHash());
        initial.setVersionNote("Initial upload");
        initial.setUploadedBy(evidence.getUploadedBy());
        initial.setUploadedAt(evidence.getUploadedAt() != null ? evidence.getUploadedAt() : OffsetDateTime.now());
        evidenceVersionRepository.save(initial);
    }

    private int nextVersionNumber(Evidence evidence) {
        int highestRecorded = evidenceVersionRepository.findByEvidenceIdOrderByVersionNumberDesc(evidence.getId()).stream()
                .mapToInt(EvidenceVersion::getVersionNumber)
                .max()
                .orElse(0);
        return Math.max(Math.max(1, evidence.getCurrentVersion()), highestRecorded) + 1;
    }

    private VersionFileTarget resolveVersionFileTarget(Evidence evidence, UUID versionId) {
        if ("LINK".equalsIgnoreCase(evidence.getFileType())) {
            throw new BadRequestException("Version files are not applicable for link evidence.");
        }
        Optional<EvidenceVersion> versionOpt = evidenceVersionRepository.findByIdAndEvidenceId(versionId, evidence.getId());
        if (versionOpt.isPresent()) {
            EvidenceVersion v = versionOpt.get();
            return new VersionFileTarget(v.getOriginalFileName(), v.getFileType(), v.getFilePath());
        }
        if (versionId.equals(evidence.getId())) {
            return new VersionFileTarget(evidence.getOriginalFileName(), evidence.getFileType(), evidence.getFilePath());
        }
        throw new ResourceNotFoundException("Evidence version not found");
    }

    private EvidenceVersionResponse toVersionResponse(EvidenceVersion v, boolean isCurrent) {
        User uploadedBy = v.getUploadedBy();
        return new EvidenceVersionResponse(
                v.getId(),
                v.getEvidence().getId(),
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

    private record VersionFileTarget(String originalFileName, String fileType, String filePath) {}

    private Activity findActivity(UUID activityId) {
        return activityRepository.findById(activityId)
                .orElseThrow(() -> new ResourceNotFoundException("Activity not found"));
    }

    private Evidence findEvidence(UUID evidenceId) {
        return evidenceRepository.findById(evidenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Evidence not found"));
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Evidence file must not be empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Evidence file must not exceed 10 MB");
        }
        String extension = getExtension(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BadRequestException("Unsupported file type. Allowed types: PDF, DOCX, XLSX, JPG, JPEG, PNG");
        }
    }

    private String contentTypeFor(String extension) {
        return switch (extension.toLowerCase(Locale.ROOT)) {
            case "pdf"  -> "application/pdf";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "jpg", "jpeg" -> "image/jpeg";
            case "png"  -> "image/png";
            default     -> "application/octet-stream";
        };
    }

    private MediaType previewMediaType(String fileType) {
        return switch (fileType) {
            case "PDF"        -> MediaType.APPLICATION_PDF;
            case "PNG"        -> MediaType.IMAGE_PNG;
            case "JPG", "JPEG" -> MediaType.IMAGE_JPEG;
            case "DOCX"       -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            case "XLSX"       -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            default           -> null;
        };
    }

    private String cleanFileName(String fileName) {
        if (fileName == null || fileName.trim().isEmpty()) return "evidence-file";
        return Paths.get(fileName).getFileName().toString();
    }

    private String getExtension(String fileName) {
        String cleanName = cleanFileName(fileName);
        int dot = cleanName.lastIndexOf('.');
        if (dot < 0 || dot == cleanName.length() - 1) return "";
        return cleanName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private EvidenceResponse toResponse(Evidence evidence) {
        return toResponse(evidence, null);
    }

    private EvidenceResponse toResponse(Evidence evidence, EvidenceResponse.DuplicateWarning duplicateWarning) {
        User uploadedBy = evidence.getUploadedBy();
        ActiveVersionSnapshot active = resolveActiveVersionSnapshot(evidence);
        return new EvidenceResponse(
                evidence.getId(),
                evidence.getActivity().getId(),
                evidence.getActivity().getActivityName(),
                active.originalFileName(),
                evidence.getStoredFileName(),
                evidence.getLinkUrl(),
                active.fileType(),
                active.fileSize(),
                active.currentVersion(),
                evidence.getActivity().getAccreditationArea(),
                evidence.getActivity().getAcademicYear(),
                resolveOwnerOffice(evidence),
                evidence.getEvidenceType(),
                parseRelatedOffices(evidence.getRelatedOffices()),
                parseStrings(evidence.getTags()),
                evidence.getNotes(),
                uploadedBy == null ? null : uploadedBy.getId(),
                uploadedBy == null ? null : uploadedBy.getName(),
                uploadedBy == null ? null : uploadedBy.getOffice(),
                uploadedBy == null ? null : uploadedBy.getRole().name(),
                evidence.getUploadedAt(),
                evidence.getUpdatedAt(),
                duplicateWarning
        );
    }

    private String resolveOwnerOffice(Evidence evidence) {
        User uploadedBy = evidence.getUploadedBy();
        return firstNonBlank(
                evidence.getActivity().getOffice(),
                evidence.getActivity().getDepartment() != null ? evidence.getActivity().getDepartment().name() : null,
                uploadedBy == null ? null : uploadedBy.getOffice());
    }

    private EvidenceMetadataResponse toMetadataResponse(Evidence evidence) {
        return new EvidenceMetadataResponse(
                evidence.getId(),
                evidence.getActivity().getId(),
                evidence.getOriginalFileName(),
                evidence.getActivity().getAccreditationArea(),
                evidence.getActivity().getAcademicYear(),
                evidence.getEvidenceType(),
                parseRelatedOffices(evidence.getRelatedOffices()),
                parseStrings(evidence.getTags()),
                evidence.getNotes(),
                evidence.getUpdatedAt()
        );
    }

    private String joinEnums(List<? extends Enum<?>> values) {
        if (values == null || values.isEmpty()) return null;
        return values.stream().filter(Objects::nonNull).map(Enum::name).distinct()
                .reduce((a, b) -> a + "," + b).orElse(null);
    }

    private void applyMetadata(Evidence evidence,
                               com.aercs.entity.EvidenceType evidenceType,
                               List<RelatedOffice> relatedOffices,
                               List<String> tags,
                               String notes) {
        evidence.setEvidenceType(evidenceType);
        evidence.setRelatedOffices(joinEnums(relatedOffices));
        evidence.setTags(joinStrings(tags));
        evidence.setNotes(trimToNull(notes));
    }

    private String joinStrings(List<String> values) {
        if (values == null || values.isEmpty()) return null;
        return values.stream().filter(v -> v != null && !v.trim().isEmpty()).map(String::trim).distinct()
                .reduce((a, b) -> a + "," + b).orElse(null);
    }

    private List<RelatedOffice> parseRelatedOffices(String value) {
        if (value == null || value.trim().isEmpty()) return List.of();
        return Arrays.stream(value.split(",")).map(String::trim).filter(t -> !t.isEmpty())
                .map(RelatedOffice::valueOf).toList();
    }

    private List<String> parseStrings(String value) {
        if (value == null || value.trim().isEmpty()) return List.of();
        return Arrays.stream(value.split(",")).map(String::trim).filter(t -> !t.isEmpty()).toList();
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        return value.trim();
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    private void assertCanModify(Evidence evidence, String userIdOrIdentifier) {
        User currentUser = userRepository.findByIdentifier(userIdOrIdentifier).orElse(null);
        if (currentUser == null) throw new ForbiddenException("User not found");

        if (currentUser.getRole() == com.aercs.entity.UserRole.ADMIN) return;

        User uploader = evidence.getUploadedBy();
        if (uploader == null || !uploader.getId().equals(currentUser.getId())) {
            throw new ForbiddenException("Only the uploader can modify this evidence");
        }
    }

    private void assertCanModify(Evidence evidence, UUID currentUserId) {
        assertCanModify(evidence, currentUserId != null ? currentUserId.toString() : null);
    }

    public record EvidenceDownload(String originalFileName, String fileType, long fileSize, MediaType mediaType, Resource resource) {}
}

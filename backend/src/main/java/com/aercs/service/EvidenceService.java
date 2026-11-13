package com.aercs.service;

import com.aercs.dto.request.BatchEvidenceMetadataRequest;
import com.aercs.dto.request.CreateLinkEvidenceRequest;
import com.aercs.dto.request.EvidenceMetadataRequest;
import com.aercs.dto.request.UpdateLinkEvidenceRequest;
import com.aercs.dto.response.EvidenceMetadataResponse;
import com.aercs.dto.response.EvidenceResponse;
import com.aercs.entity.Activity;
import com.aercs.entity.Evidence;
import com.aercs.entity.EvidenceVersion;
import com.aercs.entity.RelatedOffice;
import com.aercs.entity.User;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.EvidenceVersionRepository;
import com.aercs.repository.UserRepository;
import com.aercs.util.DriveLinkPolicy;
import com.aercs.util.EvidenceFiles;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * Evidence records: uploads, links, metadata, downloads and deletion.
 * The file version history lives in {@link EvidenceVersionService}.
 */
@Service
@RequiredArgsConstructor
public class EvidenceService {

    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "docx", "xlsx", "jpg", "jpeg", "png");

    private final EvidenceRepository evidenceRepository;
    private final EvidenceVersionRepository evidenceVersionRepository;
    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final SupabaseStorageService storageReader;
    private final TransactionalStorage storage;
    private final EvidenceAccessService accessService;
    private final EvidenceVersionService versionService;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public List<EvidenceResponse> uploadEvidence(UUID activityId, List<MultipartFile> files, String userId) {
        Activity activity = findActivity(activityId);
        accessService.assertCanAddToActivity(activity, userId);
        if (files == null || files.isEmpty()) {
            throw new BadRequestException("Select at least one evidence file");
        }
        // Uploads into one activity take turns, so two simultaneous uploads can't both pass the
        // duplicate / same-name checks below and end up as twin records.
        entityManager.refresh(activity, LockModeType.PESSIMISTIC_WRITE);

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
        String cleanName = EvidenceFiles.cleanFileName(file.getOriginalFilename());

        List<Evidence> sameActivityEvidence = evidenceRepository.findByActivityIdOrderByUploadedAtDesc(activity.getId());
        Evidence sameContentInActivity = sameActivityEvidence.stream()
                .filter(e -> fileHash.equals(e.getFileHash()) && e.getFileSize() == file.getSize())
                .findFirst()
                .orElse(null);
        if (sameContentInActivity != null) {
            throw new BadRequestException("Duplicate file content: \"" + cleanName
                    + "\" has identical content to \"" + sameContentInActivity.getOriginalFileName()
                    + "\" (v" + Math.max(1, sameContentInActivity.getCurrentVersion()) + ") already in this activity.");
        }

        Evidence sameNameInActivity = sameActivityEvidence.stream()
                .filter(e -> !"LINK".equalsIgnoreCase(e.getFileType()))
                .filter(e -> cleanName.equalsIgnoreCase(e.getOriginalFileName()))
                .findFirst()
                .orElse(null);

        // A matching hash only counts if the stored file is the same size too: records whose
        // file was replaced before the hash was kept in sync carry a stale hash and must not
        // be reported as duplicates of a file they no longer hold.
        Evidence existingDuplicate = evidenceRepository.findByFileHashOrderByUploadedAtAsc(fileHash).stream()
                .filter(e -> e.getFileSize() == file.getSize())
                .filter(e -> sameNameInActivity == null || !e.getId().equals(sameNameInActivity.getId()))
                .findFirst()
                .orElse(null);

        Evidence saved;
        if (sameNameInActivity != null) {
            saved = versionService.addNewVersion(
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

    // The hash decides whether a file is a duplicate, so an upload whose hash can't be computed
    // is rejected rather than allowed to skip the check.
    private String computeFileHash(MultipartFile file) {
        try {
            return EvidenceFiles.sha256(file);
        } catch (IOException e) {
            throw new BadRequestException("Unable to read the uploaded file");
        }
    }

    @Transactional
    public EvidenceResponse createLinkEvidence(UUID activityId, CreateLinkEvidenceRequest request, String userId) {
        Activity activity = findActivity(activityId);
        accessService.assertCanAddToActivity(activity, userId);
        assertNotDriveFolderLink(request.linkUrl());
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
        assertNotDriveFolderLink(request.linkUrl());

        evidence.setOriginalFileName(trimToNull(request.title()) != null ? request.title().trim() : "Google Drive Link");
        evidence.setLinkUrl(request.linkUrl().trim());
        evidence.setUpdatedAt(OffsetDateTime.now());

        return toResponse(evidenceRepository.save(evidence));
    }

    // Evidence must be a document: links to a Google Drive folder are not accepted.
    private void assertNotDriveFolderLink(String linkUrl) {
        if (DriveLinkPolicy.isGoogleDriveFolderLink(linkUrl)) {
            throw new BadRequestException(DriveLinkPolicy.FOLDER_LINK_MESSAGE);
        }
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
        User editor = findUser(currentUserId);
        applyMetadata(evidence, request.evidenceType(), request.relatedOffices(), request.tags(), request.notes(), editor);
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
        User editor = findUser(currentUserId);

        return selectedEvidence.stream()
                .map(evidence -> {
                    applyMetadata(evidence, request.evidenceType(), request.relatedOffices(), request.tags(), request.notes(), editor);
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
        byte[] bytes = storageReader.download(active.filePath());
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
        MediaType mediaType = EvidenceFiles.previewMediaType(active.fileType());
        if (mediaType == null) {
            throw new BadRequestException("Preview is not available for this file type. Please download the file.");
        }
        byte[] bytes = storageReader.download(active.filePath());
        return new EvidenceDownload(
                active.originalFileName(),
                active.fileType(),
                bytes.length,
                mediaType,
                new ByteArrayResource(bytes)
        );
    }

    /**
     * The file an evidence record currently stands for. The record mirrors its active version
     * (see {@link EvidenceVersionService}), so this reads the record itself and needs no
     * history lookup, which keeps listing and searching evidence cheap.
     */
    public ActiveVersionSnapshot resolveActiveVersionSnapshot(Evidence evidence) {
        return new ActiveVersionSnapshot(
                evidence.getOriginalFileName(),
                evidence.getFilePath(),
                evidence.getFileType(),
                evidence.getFileSize(),
                Math.max(1, evidence.getCurrentVersion())
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
        User uploader = userRepository.findByIdentifier(userId).orElse(evidence.getUploadedBy());
        String note = trimToNull(versionNote) != null ? trimToNull(versionNote) : "Replaced file";
        return toResponse(versionService.addNewVersion(evidence, file, fileHash, uploader, note));
    }

    @Transactional
    public EvidenceResponse restoreVersion(UUID evidenceId, UUID versionId, String userId) {
        return toResponse(versionService.restoreVersion(evidenceId, versionId, userId));
    }

    @Transactional
    public void deleteEvidence(UUID evidenceId, UUID currentUserId) {
        Evidence evidence = findEvidence(evidenceId);
        assertCanModify(evidence, currentUserId);
        Set<String> objectPaths = new LinkedHashSet<>();
        if (evidence.getFilePath() != null && !evidence.getFilePath().isBlank()) {
            objectPaths.add(evidence.getFilePath());
        }
        List<EvidenceVersion> versions = evidenceVersionRepository.findByEvidenceIdOrderByVersionNumberDesc(evidenceId);
        versions.stream()
                .map(EvidenceVersion::getFilePath)
                .filter(p -> p != null && !p.isBlank())
                .forEach(objectPaths::add);
        evidenceVersionRepository.deleteAll(versions);
        evidenceRepository.delete(evidence);
        // Flush so the "is anything still using this file?" checks below see the deletions.
        evidenceRepository.flush();
        for (String path : objectPaths) {
            if (!evidenceVersionRepository.existsByFilePath(path)
                    && !evidenceRepository.existsByFilePath(path)) {
                storage.deleteAfterCommit(path);
            }
        }
    }

    private Evidence saveEvidenceFile(Activity activity, MultipartFile file, User uploadedBy, String fileHash) {
        validateFile(file);
        String extension = EvidenceFiles.getExtension(file.getOriginalFilename());
        String storedFileName = UUID.randomUUID() + "." + extension;
        String objectPath = activity.getId() + "/" + storedFileName;

        try {
            storage.upload(objectPath, file.getBytes(), EvidenceFiles.contentTypeFor(extension));
        } catch (IOException e) {
            throw new BadRequestException("Unable to store evidence file");
        }

        Evidence evidence = new Evidence();
        evidence.setActivity(activity);
        evidence.setOriginalFileName(EvidenceFiles.cleanFileName(file.getOriginalFilename()));
        evidence.setStoredFileName(storedFileName);
        evidence.setFilePath(objectPath);
        evidence.setFileType(extension.toUpperCase(Locale.ROOT));
        evidence.setFileSize(file.getSize());
        evidence.setCurrentVersion(1);
        evidence.setFileHash(fileHash);
        evidence.setUploadedBy(uploadedBy);
        Evidence saved = evidenceRepository.save(evidence);

        versionService.recordInitialVersion(saved, uploadedBy);
        return saved;
    }

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
        String extension = EvidenceFiles.getExtension(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BadRequestException("Unsupported file type. Allowed types: PDF, DOCX, XLSX, JPG, JPEG, PNG");
        }
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
        User editor = evidence.getMetadataUpdatedBy();
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
                evidence.getUpdatedAt(),
                editor == null ? null : editor.getId(),
                editor == null ? null : editor.getName(),
                evidence.getMetadataUpdatedAt()
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
                               String notes,
                               User editor) {
        evidence.setEvidenceType(evidenceType);
        evidence.setRelatedOffices(joinEnums(relatedOffices));
        evidence.setTags(joinStrings(tags));
        evidence.setNotes(trimToNull(notes));
        // Record who made this change, so a chairperson overriding staff metadata is traceable.
        evidence.setMetadataUpdatedBy(editor);
        evidence.setMetadataUpdatedAt(OffsetDateTime.now());
    }

    private User findUser(UUID userId) {
        return userId == null ? null : userRepository.findById(userId).orElse(null);
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
        accessService.assertCanModify(evidence, userIdOrIdentifier);
    }

    private void assertCanModify(Evidence evidence, UUID currentUserId) {
        assertCanModify(evidence, currentUserId != null ? currentUserId.toString() : null);
    }

    public record EvidenceDownload(String originalFileName, String fileType, long fileSize, MediaType mediaType, Resource resource) {}
}

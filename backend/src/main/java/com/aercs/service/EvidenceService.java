package com.aercs.service;

import com.aercs.dto.request.EvidenceMetadataRequest;
import com.aercs.dto.response.EvidenceMetadataResponse;
import com.aercs.dto.response.EvidenceResponse;
import com.aercs.entity.Activity;
import com.aercs.entity.Evidence;
import com.aercs.entity.RelatedOffice;
import com.aercs.entity.User;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
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
import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EvidenceService {

    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "docx", "xlsx", "jpg", "jpeg", "png");

    private final EvidenceRepository evidenceRepository;
    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final SupabaseStorageService storageService;

    @Transactional
    public List<EvidenceResponse> uploadEvidence(UUID activityId, List<MultipartFile> files, String userId) {
        Activity activity = findActivity(activityId);
        if (files == null || files.isEmpty()) {
            throw new BadRequestException("Select at least one evidence file");
        }
        User uploadedBy = userRepository.findById(UUID.fromString(userId)).orElse(null);
        return files.stream()
                .map(file -> saveEvidenceFile(activity, file, uploadedBy))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EvidenceResponse> listEvidence(UUID activityId) {
        findActivity(activityId);
        return evidenceRepository.findByActivityIdOrderByUploadedAtDesc(activityId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public EvidenceResponse getEvidence(UUID evidenceId) {
        return toResponse(findEvidence(evidenceId));
    }

    @Transactional(readOnly = true)
    public EvidenceMetadataResponse getMetadata(UUID evidenceId) {
        return toMetadataResponse(findEvidence(evidenceId));
    }

    @Transactional
    public EvidenceMetadataResponse updateMetadata(UUID evidenceId, EvidenceMetadataRequest request) {
        Evidence evidence = findEvidence(evidenceId);
        evidence.setEvidenceType(request.evidenceType());
        evidence.setRelatedOffices(joinEnums(request.relatedOffices()));
        evidence.setTags(joinStrings(request.tags()));
        evidence.setNotes(trimToNull(request.notes()));
        return toMetadataResponse(evidenceRepository.save(evidence));
    }

    @Transactional(readOnly = true)
    public EvidenceDownload getDownload(UUID evidenceId) {
        Evidence evidence = findEvidence(evidenceId);
        byte[] bytes = storageService.download(evidence.getFilePath());
        return new EvidenceDownload(
                evidence.getOriginalFileName(),
                evidence.getFileType(),
                bytes.length,
                MediaType.APPLICATION_OCTET_STREAM,
                new ByteArrayResource(bytes)
        );
    }

    @Transactional(readOnly = true)
    public EvidenceDownload getView(UUID evidenceId) {
        Evidence evidence = findEvidence(evidenceId);
        MediaType mediaType = previewMediaType(evidence.getFileType());
        if (mediaType == null) {
            throw new BadRequestException("Preview is not available for this file type. Please download the file.");
        }
        byte[] bytes = storageService.download(evidence.getFilePath());
        return new EvidenceDownload(
                evidence.getOriginalFileName(),
                evidence.getFileType(),
                bytes.length,
                mediaType,
                new ByteArrayResource(bytes)
        );
    }

    @Transactional
    public EvidenceResponse replaceEvidence(UUID evidenceId, MultipartFile file, String userId) {
        Evidence evidence = findEvidence(evidenceId);
        validateFile(file);

        String oldPath = evidence.getFilePath();
        String extension = getExtension(file.getOriginalFilename());
        String storedFileName = UUID.randomUUID() + "." + extension;
        String objectPath = evidence.getActivity().getId() + "/" + storedFileName;

        try {
            storageService.upload(objectPath, file.getBytes(), contentTypeFor(extension));
        } catch (IOException e) {
            throw new BadRequestException("Unable to store evidence file");
        }

        evidence.setOriginalFileName(cleanFileName(file.getOriginalFilename()));
        evidence.setStoredFileName(storedFileName);
        evidence.setFilePath(objectPath);
        evidence.setFileType(extension.toUpperCase(Locale.ROOT));
        evidence.setFileSize(file.getSize());
        evidence.setUpdatedAt(OffsetDateTime.now());
        userRepository.findById(UUID.fromString(userId)).ifPresent(evidence::setUploadedBy);

        Evidence saved = evidenceRepository.save(evidence);
        storageService.delete(oldPath);
        return toResponse(saved);
    }

    @Transactional
    public void deleteEvidence(UUID evidenceId) {
        Evidence evidence = findEvidence(evidenceId);
        String objectPath = evidence.getFilePath();
        evidenceRepository.delete(evidence);
        storageService.delete(objectPath);
    }

    private Evidence saveEvidenceFile(Activity activity, MultipartFile file, User uploadedBy) {
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
        evidence.setUploadedBy(uploadedBy);
        return evidenceRepository.save(evidence);
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
        User uploadedBy = evidence.getUploadedBy();
        return new EvidenceResponse(
                evidence.getId(),
                evidence.getActivity().getId(),
                evidence.getActivity().getActivityName(),
                evidence.getOriginalFileName(),
                evidence.getStoredFileName(),
                evidence.getFileType(),
                evidence.getFileSize(),
                evidence.getActivity().getAccreditationArea(),
                evidence.getActivity().getAcademicYear(),
                firstNonBlank(evidence.getActivity().getOffice(), evidence.getActivity().getDepartment(),
                        uploadedBy == null ? null : uploadedBy.getDepartment()),
                evidence.getEvidenceType(),
                parseRelatedOffices(evidence.getRelatedOffices()),
                parseStrings(evidence.getTags()),
                evidence.getNotes(),
                uploadedBy == null ? null : uploadedBy.getId(),
                uploadedBy == null ? null : uploadedBy.getName(),
                uploadedBy == null ? null : uploadedBy.getDepartment(),
                uploadedBy == null ? null : uploadedBy.getRole().name(),
                evidence.getUploadedAt(),
                evidence.getUpdatedAt()
        );
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

    public record EvidenceDownload(String originalFileName, String fileType, long fileSize, MediaType mediaType, Resource resource) {}
}

package com.aercs.service;

import com.aercs.dto.request.GenerateAccreditorAccessRequest;
import com.aercs.dto.response.AccreditorAccessEvidenceResponse;
import com.aercs.dto.response.GenerateAccreditorAccessResponse;
import com.aercs.dto.response.PublicAccreditorAccessResponse;
import com.aercs.entity.AccreditorAccess;
import com.aercs.entity.Activity;
import com.aercs.entity.Evidence;
import com.aercs.entity.User;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.AccreditorAccessRepository;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.EvidenceReferenceRepository;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccreditorAccessService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;

    private final AccreditorAccessRepository accessRepository;
    private final EvidenceRepository evidenceRepository;
    private final EvidenceReferenceRepository evidenceReferenceRepository;
    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final EvidenceService evidenceService;

    @Transactional
    public GenerateAccreditorAccessResponse generateAccess(
            GenerateAccreditorAccessRequest request,
            UUID currentUserId,
            String frontendOrigin
    ) {
        Set<Evidence> selectedEvidence = new LinkedHashSet<>();
        Activity activity = null;

        if (request.activityId() != null) {
            activity = activityRepository.findById(request.activityId())
                    .orElseThrow(() -> new ResourceNotFoundException("Activity not found"));
            selectedEvidence.addAll(evidenceRepository.findByActivityIdOrderByUploadedAtDesc(request.activityId()));
            selectedEvidence.addAll(evidenceReferenceRepository.findReferencedEvidenceByActivityId(request.activityId()));
        }

        if (request.evidenceIds() != null && !request.evidenceIds().isEmpty()) {
            List<Evidence> evidence = evidenceRepository.findAllById(request.evidenceIds());
            if (evidence.size() != request.evidenceIds().stream().distinct().count()) {
                throw new ResourceNotFoundException("One or more evidence files were not found");
            }
            selectedEvidence.addAll(evidence);
        }

        if (selectedEvidence.isEmpty()) {
            throw new BadRequestException("Select at least one evidence file for accreditor access");
        }

        OffsetDateTime expiresAt = request.expirationDateTime() == null
                ? OffsetDateTime.now().plusDays(7)
                : request.expirationDateTime();
        if (!expiresAt.isAfter(OffsetDateTime.now())) {
            throw new BadRequestException("Expiration date must be in the future");
        }

        User createdBy = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        AccreditorAccess access = new AccreditorAccess();
        access.setToken(generateUniqueToken());
        access.setCreatedBy(createdBy);
        access.setActivity(activity);
        access.setEvidence(selectedEvidence);
        access.setExpiresAt(expiresAt);
        access.setNotes(trimToNull(request.notes()));

        AccreditorAccess saved = accessRepository.save(access);
        return new GenerateAccreditorAccessResponse(
                saved.getId(),
                saved.getToken(),
                normalizeFrontendOrigin(frontendOrigin) + "/accreditor-access/" + saved.getToken(),
                saved.getExpiresAt(),
                saved.getEvidence().size()
        );
    }

    @Transactional(readOnly = true)
    public PublicAccreditorAccessResponse getPublicAccess(String token) {
        AccreditorAccess access = getValidAccess(token);
        return new PublicAccreditorAccessResponse(
                access.getId(),
                access.getNotes(),
                access.getExpiresAt(),
                access.getEvidence().stream()
                        .map(this::toEvidenceResponse)
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public EvidenceService.EvidenceDownload getPublicView(String token, UUID evidenceId) {
        ensureEvidenceAllowed(token, evidenceId);
        return evidenceService.getView(evidenceId);
    }

    @Transactional(readOnly = true)
    public EvidenceService.EvidenceDownload getPublicDownload(String token, UUID evidenceId) {
        ensureEvidenceAllowed(token, evidenceId);
        return evidenceService.getDownload(evidenceId);
    }

    private void ensureEvidenceAllowed(String token, UUID evidenceId) {
        AccreditorAccess access = getValidAccess(token);
        boolean allowed = access.getEvidence().stream().anyMatch(e -> e.getId().equals(evidenceId));
        if (!allowed) {
            throw new ResourceNotFoundException("Evidence file not found for this access link");
        }
    }

    private AccreditorAccess getValidAccess(String token) {
        AccreditorAccess access = accessRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Access link is invalid or expired"));
        if (!access.isActive() || !access.getExpiresAt().isAfter(OffsetDateTime.now())) {
            throw new ResourceNotFoundException("Access link is invalid or expired");
        }
        return access;
    }

    private AccreditorAccessEvidenceResponse toEvidenceResponse(Evidence evidence) {
        Activity activity = evidence.getActivity();
        return new AccreditorAccessEvidenceResponse(
                evidence.getId(),
                evidence.getOriginalFileName(),
                evidence.getFileType(),
                evidence.getFileSize(),
                activity.getActivityName(),
                firstNonBlank(activity.getOffice(), activity.getDepartment()),
                activity.getAccreditationArea(),
                activity.getAcademicYear(),
                evidence.getEvidenceType()
        );
    }

    private String generateUniqueToken() {
        String token;
        do {
            byte[] bytes = new byte[TOKEN_BYTES];
            SECURE_RANDOM.nextBytes(bytes);
            token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        } while (accessRepository.existsByToken(token));
        return token;
    }

    private String normalizeFrontendOrigin(String frontendOrigin) {
        if (frontendOrigin == null || frontendOrigin.isBlank()) {
            return "http://localhost:3000";
        }
        return frontendOrigin.replaceAll("/+$", "");
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

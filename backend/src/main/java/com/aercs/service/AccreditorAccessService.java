package com.aercs.service;

import com.aercs.dto.request.GenerateAccreditorAccessRequest;
import com.aercs.dto.request.UpdateAccreditorAccessRequest;
import com.aercs.dto.response.AccreditorAccessEvidenceResponse;
import com.aercs.dto.response.GenerateAccreditorAccessResponse;
import com.aercs.dto.response.PublicAccreditorAccessResponse;
import com.aercs.entity.AccreditorAccess;
import com.aercs.entity.Activity;
import com.aercs.entity.Evidence;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ForbiddenException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.AccreditorAccessRepository;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.EvidenceReferenceRepository;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private static final String TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final int TOKEN_LENGTH = 10;

    private final AccreditorAccessRepository accessRepository;
    private final EvidenceRepository evidenceRepository;
    private final EvidenceReferenceRepository evidenceReferenceRepository;
    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final EvidenceService evidenceService;
    private final InvitationEmailService invitationEmailService;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public GenerateAccreditorAccessResponse generateAccess(
            GenerateAccreditorAccessRequest request,
            UUID currentUserId,
            String frontendOrigin
    ) {
        Set<UUID> selectedEvidenceIds = new LinkedHashSet<>();
        Activity activity = null;

        if (request.activityId() != null) {
            activity = activityRepository.findById(request.activityId())
                    .orElseThrow(() -> new ResourceNotFoundException("Activity not found"));
            evidenceRepository.findByActivityIdOrderByUploadedAtDesc(request.activityId()).stream()
                    .map(Evidence::getId)
                    .forEach(selectedEvidenceIds::add);
            evidenceReferenceRepository.findReferencedEvidenceByActivityId(request.activityId()).stream()
                    .map(Evidence::getId)
                    .forEach(selectedEvidenceIds::add);
        }

        if (request.evidenceIds() != null && !request.evidenceIds().isEmpty()) {
            selectedEvidenceIds.addAll(request.evidenceIds());
        }

        if (selectedEvidenceIds.isEmpty()) {
            throw new BadRequestException("Select at least one evidence file for accreditor access");
        }

        List<Evidence> evidence = evidenceRepository.findAllById(selectedEvidenceIds);
        if (evidence.size() != selectedEvidenceIds.size()) {
            throw new ResourceNotFoundException("One or more evidence files were not found");
        }
        Set<Evidence> selectedEvidence = new LinkedHashSet<>(evidence);

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
        access.setAccreditorEmail(request.accreditorEmail().trim());
        access.setCreatedBy(createdBy);
        access.setActivity(activity);
        access.setEvidence(selectedEvidence);
        access.setExpiresAt(expiresAt);
        access.setNotes(trimToNull(request.notes()));

        AccreditorAccess saved = accessRepository.save(access);
        String accessUrl = buildAccessUrl(frontendOrigin, saved.getToken());
        invitationEmailService.sendAccreditorAccess(
                request.accreditorEmail().trim(),
                accessUrl,
                saved.getExpiresAt(),
                saved.getNotes()
        );
        return new GenerateAccreditorAccessResponse(
                saved.getId(),
                saved.getToken(),
                accessUrl,
                saved.getExpiresAt(),
                saved.getEvidence().size()
        );
    }

    @Transactional
    public GenerateAccreditorAccessResponse extendExpiry(
            UUID id,
            UpdateAccreditorAccessRequest request,
            UUID currentUserId,
            String frontendOrigin
    ) {
        AccreditorAccess access = findAccess(id);
        assertCanModify(access, currentUserId);

        if (!request.expiresAt().isAfter(OffsetDateTime.now())) {
            throw new BadRequestException("Expiration date must be in the future");
        }
        access.setExpiresAt(request.expiresAt());
        AccreditorAccess saved = accessRepository.save(access);

        return new GenerateAccreditorAccessResponse(
                saved.getId(),
                saved.getToken(),
                buildAccessUrl(frontendOrigin, saved.getToken()),
                saved.getExpiresAt(),
                saved.getEvidence().size()
        );
    }

    @Transactional
    public void deleteAccess(UUID id, UUID currentUserId) {
        AccreditorAccess access = findAccess(id);
        assertCanModify(access, currentUserId);
        accessRepository.delete(access);
    }

    private AccreditorAccess findAccess(UUID id) {
        return accessRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Access link not found"));
    }

    private void assertCanModify(AccreditorAccess access, UUID currentUserId) {
        User currentUser = userRepository.findById(currentUserId).orElse(null);
        if (currentUser == null) throw new ForbiddenException("User not found");

        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN || currentUser.getRole() == UserRole.ACCRED_COORDINATOR;
        if (isAdmin) return;

        User createdBy = access.getCreatedBy();
        if (createdBy == null || !createdBy.getId().equals(currentUserId)) {
            throw new ForbiddenException("Only the creator can modify this access link");
        }
    }

    @Transactional(readOnly = true)
    public PublicAccreditorAccessResponse getPublicAccess(String token) {
        AccreditorAccess access = getValidAccess(token);
        return getPublicAccess(access);
    }

    public void requestOtp(String token) {
        AccreditorAccess access = getValidAccess(token);
        if (access.getAccreditorEmail() == null || access.getAccreditorEmail().isBlank()) {
            throw new BadRequestException("This access link does not have an invited email address");
        }
        String code = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        access.setOtpHash(passwordEncoder.encode(code));
        access.setOtpExpiresAt(OffsetDateTime.now().plusMinutes(10));
        access.setVerifiedSessionHash(null);
        access.setVerifiedSessionExpiresAt(null);
        accessRepository.save(access);
        invitationEmailService.sendAccreditorOtp(access.getAccreditorEmail(), code);
    }

    public String verifyOtp(String token, String code) {
        AccreditorAccess access = getValidAccess(token);
        if (access.getOtpHash() == null || access.getOtpExpiresAt() == null
                || !access.getOtpExpiresAt().isAfter(OffsetDateTime.now())
                || !passwordEncoder.matches(code, access.getOtpHash())) {
            throw new BadRequestException("The verification code is invalid or expired");
        }
        String sessionToken = generateSessionToken();
        access.setVerifiedSessionHash(passwordEncoder.encode(sessionToken));
        access.setVerifiedSessionExpiresAt(OffsetDateTime.now().plusHours(8));
        access.setOtpHash(null);
        access.setOtpExpiresAt(null);
        accessRepository.save(access);
        return sessionToken;
    }

    private PublicAccreditorAccessResponse getPublicAccess(AccreditorAccess access) {
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

    public void requireVerified(String token, String sessionToken) {
        AccreditorAccess access = getValidAccess(token);
        if (sessionToken == null || access.getVerifiedSessionHash() == null
                || access.getVerifiedSessionExpiresAt() == null
                || !access.getVerifiedSessionExpiresAt().isAfter(OffsetDateTime.now())
                || !passwordEncoder.matches(sessionToken, access.getVerifiedSessionHash())) {
            throw new ForbiddenException("Accreditor verification is required");
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
                evidence.getLinkUrl(),
                evidence.getFileType(),
                evidence.getFileSize(),
                activity.getActivityName(),
                firstNonBlank(
                        activity.getOffice(),
                        activity.getDepartment() != null ? activity.getDepartment().name() : null),
                activity.getAccreditationArea(),
                activity.getAcademicYear(),
                evidence.getEvidenceType()
        );
    }

    private String generateUniqueToken() {
        String token;
        do {
            StringBuilder value = new StringBuilder(TOKEN_LENGTH);
            for (int i = 0; i < TOKEN_LENGTH; i++) {
                value.append(TOKEN_ALPHABET.charAt(SECURE_RANDOM.nextInt(TOKEN_ALPHABET.length())));
            }
            token = value.toString();
        } while (accessRepository.existsByToken(token));
        return token;
    }

    private String generateSessionToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String normalizeFrontendOrigin(String frontendOrigin) {
        if (frontendOrigin == null || frontendOrigin.isBlank()) {
            return "http://localhost:3000";
        }
        return frontendOrigin.replaceAll("/+$", "");
    }

    private String buildAccessUrl(String frontendOrigin, String token) {
        return normalizeFrontendOrigin(frontendOrigin) + "/a/" + token;
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

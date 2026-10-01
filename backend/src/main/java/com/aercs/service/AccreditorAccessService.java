package com.aercs.service;

import com.aercs.dto.request.AssignAccreditorsRequest;
import com.aercs.dto.request.GenerateAccreditorAccessRequest;
import com.aercs.dto.request.UpdateAccreditorAccessRequest;
import com.aercs.dto.response.AccreditorAccessEvidenceResponse;
import com.aercs.dto.response.AccreditorAccessLinkResponse;
import com.aercs.dto.response.AccreditorLinkDetailResponse;
import com.aercs.dto.response.AccreditorLinkResponse;
import com.aercs.dto.response.AccreditorSummaryResponse;
import com.aercs.dto.response.GenerateAccreditorAccessResponse;
import com.aercs.entity.AccreditorAccess;
import com.aercs.entity.Activity;
import com.aercs.entity.Evidence;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ForbiddenException;
import com.aercs.exception.InvitationEmailException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.AccreditorAccessRepository;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.EvidenceReferenceRepository;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
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

    // ---------------------------------------------------------------------------------
    // Staff: create and manage links
    // ---------------------------------------------------------------------------------

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
        Set<User> accreditors = resolveAccreditors(request.accreditorIds());

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
        access.setName(request.name().trim());
        access.setCreatedBy(createdBy);
        access.setActivity(activity);
        access.setEvidence(selectedEvidence);
        access.setAccreditors(accreditors);
        access.setExpiresAt(expiresAt);
        access.setNotes(trimToNull(request.notes()));

        AccreditorAccess saved = accessRepository.save(access);
        List<String> emailFailures = notifyAccreditors(
                groupByAccreditor(saved, accreditors), frontendOrigin);

        return toGenerateResponse(saved, emailFailures);
    }

    @Transactional(readOnly = true)
    public List<AccreditorAccessLinkResponse> listManageableLinks(UUID currentUserId) {
        User currentUser = findCurrentUser(currentUserId);
        // Everyone in the creator's office/department can see a link; only the creator (or an
        // admin / accreditation coordinator) can change it - see assertCanModify.
        String office = currentUser.getOffice();
        List<AccreditorAccess> links;
        if (canModifyAll(currentUser)) {
            links = accessRepository.findAllByOrderByCreatedAtDesc();
        } else if (office == null || office.isBlank()) {
            links = accessRepository.findByCreatedByIdOrderByCreatedAtDesc(currentUserId);
        } else {
            links = accessRepository.findVisibleToOffice(currentUserId, office);
        }
        return links.stream().map(link -> toLinkResponse(link, canEdit(currentUser, link))).toList();
    }

    @Transactional(readOnly = true)
    public List<AccreditorSummaryResponse> listAccreditors() {
        return userRepository.findByRoleAndActiveTrueOrderByNameAsc(UserRole.ACCREDITOR_LINK).stream()
                .map(this::toAccreditorSummary)
                .toList();
    }

    @Transactional
    public GenerateAccreditorAccessResponse updateAccess(
            UUID id,
            UpdateAccreditorAccessRequest request,
            UUID currentUserId,
            String frontendOrigin
    ) {
        AccreditorAccess access = findAccess(id);
        assertCanModify(access, currentUserId);

        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new BadRequestException("Link name is required");
            }
            access.setName(request.name().trim());
        }

        if (request.expiresAt() != null) {
            if (!request.expiresAt().isAfter(OffsetDateTime.now())) {
                throw new BadRequestException("Expiration date must be in the future");
            }
            access.setExpiresAt(request.expiresAt());
        }

        Set<User> newlyAssigned = Set.of();
        if (request.accreditorIds() != null) {
            if (request.accreditorIds().isEmpty()) {
                throw new BadRequestException("Select at least one accreditor");
            }
            Set<User> accreditors = resolveAccreditors(request.accreditorIds());
            newlyAssigned = new LinkedHashSet<>(accreditors);
            newlyAssigned.removeAll(access.getAccreditors());
            access.setAccreditors(accreditors);
        }

        AccreditorAccess saved = accessRepository.save(access);
        List<String> emailFailures = notifyAccreditors(groupByAccreditor(saved, newlyAssigned), frontendOrigin);
        return toGenerateResponse(saved, emailFailures);
    }

    // Adds every requested accreditor to every requested link. Each accreditor receives a
    // single email listing all the links newly assigned to them, not one email per link.
    @Transactional
    public List<String> assignAccreditors(AssignAccreditorsRequest request, UUID currentUserId, String frontendOrigin) {
        Set<User> accreditors = resolveAccreditors(request.accreditorIds());
        List<UUID> accessIds = List.copyOf(new LinkedHashSet<>(request.accessIds()));
        // findAllById doesn't preserve order; keep the caller's order so emails list links as selected.
        List<AccreditorAccess> links = accessRepository.findAllById(accessIds).stream()
                .sorted(Comparator.comparingInt(link -> accessIds.indexOf(link.getId())))
                .toList();
        if (links.size() != accessIds.size()) {
            throw new ResourceNotFoundException("One or more access links were not found");
        }

        Map<User, List<String>> newlyAssigned = new LinkedHashMap<>();
        for (AccreditorAccess link : links) {
            assertCanModify(link, currentUserId);
            for (User accreditor : accreditors) {
                if (link.getAccreditors().add(accreditor)) {
                    newlyAssigned.computeIfAbsent(accreditor, k -> new ArrayList<>()).add(link.getName());
                }
            }
        }
        accessRepository.saveAll(links);
        return notifyAccreditors(newlyAssigned, frontendOrigin);
    }

    @Transactional
    public void deleteAccess(UUID id, UUID currentUserId) {
        AccreditorAccess access = findAccess(id);
        assertCanModify(access, currentUserId);
        accessRepository.delete(access);
    }

    // ---------------------------------------------------------------------------------
    // Accreditor: view links assigned to the logged-in account
    // ---------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<AccreditorLinkResponse> listLinksForAccreditor(UUID accreditorId) {
        return accessRepository.findOpenLinksForAccreditor(accreditorId, OffsetDateTime.now()).stream()
                .map(access -> new AccreditorLinkResponse(
                        access.getId(),
                        displayName(access),
                        access.getNotes(),
                        access.getCreatedBy() != null ? access.getCreatedBy().getName() : null,
                        access.getCreatedAt(),
                        access.getExpiresAt(),
                        access.getEvidence().size()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public AccreditorLinkDetailResponse getLinkForAccreditor(UUID accessId, UUID accreditorId) {
        AccreditorAccess access = getOpenLinkForAccreditor(accessId, accreditorId);
        return new AccreditorLinkDetailResponse(
                access.getId(),
                displayName(access),
                access.getNotes(),
                access.getCreatedBy() != null ? access.getCreatedBy().getName() : null,
                access.getExpiresAt(),
                access.getEvidence().stream()
                        .map(this::toEvidenceResponse)
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public EvidenceService.EvidenceDownload getEvidenceView(UUID accessId, UUID evidenceId, UUID accreditorId) {
        ensureEvidenceAllowed(accessId, evidenceId, accreditorId);
        return evidenceService.getView(evidenceId);
    }

    @Transactional(readOnly = true)
    public EvidenceService.EvidenceDownload getEvidenceDownload(UUID accessId, UUID evidenceId, UUID accreditorId) {
        ensureEvidenceAllowed(accessId, evidenceId, accreditorId);
        return evidenceService.getDownload(evidenceId);
    }

    private void ensureEvidenceAllowed(UUID accessId, UUID evidenceId, UUID accreditorId) {
        AccreditorAccess access = getOpenLinkForAccreditor(accessId, accreditorId);
        boolean allowed = access.getEvidence().stream().anyMatch(e -> e.getId().equals(evidenceId));
        if (!allowed) {
            throw new ResourceNotFoundException("Evidence file not found for this access link");
        }
    }

    // Unassigned, inactive and expired links all look the same to the accreditor
    // (not found), so a link's existence is never revealed to someone it wasn't shared with.
    private AccreditorAccess getOpenLinkForAccreditor(UUID accessId, UUID accreditorId) {
        AccreditorAccess access = accessRepository.findById(accessId)
                .orElseThrow(() -> new ResourceNotFoundException("Access link is invalid or expired"));
        boolean assigned = access.getAccreditors().stream().anyMatch(u -> u.getId().equals(accreditorId));
        if (!assigned || !access.isActive() || !access.getExpiresAt().isAfter(OffsetDateTime.now())) {
            throw new ResourceNotFoundException("Access link is invalid or expired");
        }
        return access;
    }

    // ---------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------

    private AccreditorAccess findAccess(UUID id) {
        return accessRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Access link not found"));
    }

    private User findCurrentUser(UUID currentUserId) {
        if (currentUserId == null) throw new ForbiddenException("User not found");
        return userRepository.findById(currentUserId)
                .orElseThrow(() -> new ForbiddenException("User not found"));
    }

    private boolean canModifyAll(User user) {
        return user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.ACCRED_COORDINATOR;
    }

    private boolean canEdit(User user, AccreditorAccess access) {
        if (canModifyAll(user)) return true;
        User createdBy = access.getCreatedBy();
        return createdBy != null && createdBy.getId().equals(user.getId());
    }

    private void assertCanModify(AccreditorAccess access, UUID currentUserId) {
        User currentUser = findCurrentUser(currentUserId);
        if (!canEdit(currentUser, access)) {
            throw new ForbiddenException("Only the creator can modify this access link");
        }
    }

    private Set<User> resolveAccreditors(List<UUID> accreditorIds) {
        if (accreditorIds == null || accreditorIds.isEmpty()) {
            throw new BadRequestException("Select at least one accreditor");
        }
        Set<UUID> ids = new LinkedHashSet<>(accreditorIds);
        List<User> users = userRepository.findAllById(ids);
        if (users.size() != ids.size()) {
            throw new ResourceNotFoundException("One or more accreditors were not found");
        }
        for (User user : users) {
            if (user.getRole() != UserRole.ACCREDITOR_LINK || !user.isActive()) {
                throw new BadRequestException(user.getName() + " is not an active accreditor account");
            }
        }
        return new LinkedHashSet<>(users);
    }

    private Map<User, List<String>> groupByAccreditor(AccreditorAccess access, Set<User> accreditors) {
        Map<User, List<String>> grouped = new LinkedHashMap<>();
        for (User accreditor : accreditors) {
            grouped.put(accreditor, List.of(access.getName()));
        }
        return grouped;
    }

    // Email is a courtesy notice - the link already shows up in the accreditor's account -
    // so a failed send is reported back to the caller instead of rolling the assignment back.
    private List<String> notifyAccreditors(Map<User, List<String>> linksByAccreditor, String frontendOrigin) {
        String loginUrl = normalizeFrontendOrigin(frontendOrigin) + "/login";
        List<String> failures = new ArrayList<>();
        linksByAccreditor.forEach((accreditor, linkNames) -> {
            try {
                invitationEmailService.sendAccreditorLinksAssigned(accreditor, linkNames, loginUrl);
            } catch (InvitationEmailException e) {
                log.warn("Could not notify accreditor {} about assigned links", accreditor.getEmail());
                failures.add(accreditor.getEmail());
            }
        });
        return failures;
    }

    private GenerateAccreditorAccessResponse toGenerateResponse(AccreditorAccess access, List<String> emailFailures) {
        return new GenerateAccreditorAccessResponse(
                access.getId(),
                displayName(access),
                access.getExpiresAt(),
                access.getEvidence().size(),
                access.getAccreditors().size(),
                emailFailures
        );
    }

    private AccreditorAccessLinkResponse toLinkResponse(AccreditorAccess access, boolean canEdit) {
        Activity activity = access.getActivity();
        return new AccreditorAccessLinkResponse(
                access.getId(),
                displayName(access),
                access.getNotes(),
                activity != null ? activity.getId() : null,
                activity != null ? activity.getActivityName() : null,
                access.getCreatedBy() != null ? access.getCreatedBy().getName() : null,
                access.getCreatedAt(),
                access.getExpiresAt(),
                !access.isActive() || !access.getExpiresAt().isAfter(OffsetDateTime.now()),
                access.getEvidence().size(),
                access.getAccreditors().stream()
                        .sorted(Comparator.comparing(User::getName, String.CASE_INSENSITIVE_ORDER))
                        .map(this::toAccreditorSummary)
                        .toList(),
                canEdit
        );
    }

    private AccreditorSummaryResponse toAccreditorSummary(User user) {
        return new AccreditorSummaryResponse(user.getId(), user.getName(), user.getEmail());
    }

    private String displayName(AccreditorAccess access) {
        if (access.getName() != null && !access.getName().isBlank()) return access.getName();
        return access.getActivity() != null ? access.getActivity().getActivityName() : "Accreditor access link";
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

    // Links are now opened by id from a logged-in account; the token column is still
    // NOT NULL UNIQUE in the schema, so every link keeps getting one.
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

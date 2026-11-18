package com.aercs.service;

import com.aercs.dto.response.UserNotificationListResponse;
import com.aercs.dto.response.UserNotificationResponse;
import com.aercs.entity.Activity;
import com.aercs.entity.Department;
import com.aercs.entity.Evidence;
import com.aercs.entity.RelatedOffice;
import com.aercs.entity.EvidenceReference;
import com.aercs.entity.User;
import com.aercs.entity.UserNotification;
import com.aercs.entity.UserNotificationType;
import com.aercs.entity.UserRole;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceReferenceRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.UserNotificationRepository;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * The Notifications tab for department staff, chairpersons and institutional staff.
 *
 * <p>Every notice goes to everyone in the owning department or office (not only whoever made the
 * activity), except the person who caused it. Everything is in-app; the one email is for "your
 * evidence was referenced", since that is rare and something another unit did.
 *
 * <p>Writing a notice must never break the action it reports, so the public {@code notify...}
 * methods swallow and log their own failures.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserNotificationService {

    /** Uploads by one person into one activity within this long are folded into a single notice. */
    static final Duration UPLOAD_FOLD_WINDOW = Duration.ofMinutes(10);
    /** Read notices are dropped after this long. Unread ones are kept. */
    static final Duration READ_RETENTION = Duration.ofDays(90);
    private static final int MAX_EMAILS_PER_REFERENCE = 25;

    private static final Set<UserRole> NOTIFIED_ROLES =
            EnumSet.of(UserRole.DEPT_STAFF, UserRole.ACCRED_COORDINATOR, UserRole.INSTITUTIONAL_OFFICE);

    private final UserNotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final EvidenceReferenceRepository referenceRepository;
    private final EvidenceRepository evidenceRepository;
    private final ActivityRepository activityRepository;
    private final InvitationEmailService emailService;
    private final Clock clock;

    // ---------------------------------------------------------------- events

    /** Evidence (files or links) was added to {@code activity}: tell everyone in its department/office. */
    @Transactional
    public void notifyUploaded(Activity activity, User actor, List<Evidence> added) {
        if (activity == null || added == null || added.isEmpty()) return;
        safely("upload", () -> {
            Evidence latest = added.get(added.size() - 1);
            OffsetDateTime now = OffsetDateTime.now(clock);
            for (User recipient : recipientsIn(unitsOf(activity), actor)) {
                Optional<UserNotification> open = openNotice(recipient, UserNotificationType.EVIDENCE_UPLOADED, activity, actor, now);
                UserNotification notice = open.orElseGet(() -> base(recipient, UserNotificationType.EVIDENCE_UPLOADED, actor));
                notice.setActivityId(activity.getId());
                notice.setActivityName(activity.getActivityName());
                notice.setEvidenceId(latest.getId());
                notice.setEvidenceName(latest.getOriginalFileName());
                notice.setItemCount(open.isPresent() ? notice.getItemCount() + added.size() : added.size());
                notice.setCreatedAt(now);
                notificationRepository.save(notice);
            }
        });
    }

    /**
     * Evidence was tagged for other departments / offices in its metadata ({@code added} holds only
     * the tags that are new in this save): tell everyone in those units. The owning unit is left out,
     * since tagging your own unit says nothing new. Tags for several files by one person are folded
     * into one notice per activity, like uploads.
     */
    @Transactional
    public void notifyTagged(Evidence evidence, Collection<RelatedOffice> added, User actor) {
        if (evidence == null || added == null || added.isEmpty()) return;
        safely("tag", () -> {
            Set<String> units = new LinkedHashSet<>();
            added.forEach(tag -> units.addAll(unitsOf(tag)));
            units.removeAll(ownerUnits(evidence));
            Activity activity = evidence.getActivity();
            OffsetDateTime now = OffsetDateTime.now(clock);
            for (User recipient : recipientsIn(units, actor)) {
                Optional<UserNotification> open = openNotice(recipient, UserNotificationType.EVIDENCE_TAGGED, activity, actor, now);
                UserNotification notice = open.orElseGet(() -> base(recipient, UserNotificationType.EVIDENCE_TAGGED, actor));
                notice.setActivityId(activity.getId());
                notice.setActivityName(activity.getActivityName());
                notice.setEvidenceId(evidence.getId());
                notice.setEvidenceName(evidence.getOriginalFileName());
                notice.setItemCount(open.isPresent() ? notice.getItemCount() + 1 : 1);
                notice.setCreatedAt(now);
                notificationRepository.save(notice);
            }
        });
    }

    // The unread notice of this kind from this person about this activity that a new one can join.
    private Optional<UserNotification> openNotice(User recipient, UserNotificationType type, Activity activity,
                                                  User actor, OffsetDateTime now) {
        if (actor == null) return Optional.empty();
        return notificationRepository
                .findFirstByRecipientIdAndTypeAndActivityIdAndActorIdAndReadAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(
                        recipient.getId(), type, activity.getId(), actor.getId(), now.minus(UPLOAD_FOLD_WINDOW));
    }

    /** A new version of {@code evidence} is now the active one: the owning unit and units citing it are told. */
    @Transactional
    public void notifyNewVersion(Evidence evidence, User actor, int versionNumber) {
        if (evidence == null) return;
        safely("new version", () -> {
            Set<String> units = new LinkedHashSet<>(ownerUnits(evidence));
            referenceRepository.findReferencingActivities(evidence.getId()).forEach(a -> units.addAll(unitsOf(a)));
            OffsetDateTime now = OffsetDateTime.now(clock);
            for (User recipient : recipientsIn(units, actor)) {
                UserNotification notice = base(recipient, UserNotificationType.EVIDENCE_NEW_VERSION, actor);
                notice.setActivityId(evidence.getActivity().getId());
                notice.setActivityName(evidence.getActivity().getActivityName());
                notice.setEvidenceId(evidence.getId());
                notice.setEvidenceName(evidence.getOriginalFileName());
                notice.setVersionNumber(versionNumber);
                notice.setCreatedAt(now);
                notificationRepository.save(notice);
            }
        });
    }

    /** Another unit cited this evidence: in-app for the whole owning unit, plus one email each. */
    @Transactional
    public void notifyReferenced(EvidenceReference ref, User actor) {
        if (ref == null) return;
        safely("reference", () -> {
            Evidence evidence = ref.getEvidence();
            Activity citing = ref.getActivity();
            String actorUnit = actorUnit(ref, actor);
            OffsetDateTime now = OffsetDateTime.now(clock);
            List<User> recipients = recipientsIn(ownerUnits(evidence), actor);
            for (User recipient : recipients) {
                UserNotification notice = base(recipient, UserNotificationType.EVIDENCE_REFERENCED, actor);
                notice.setActorUnit(actorUnit);
                notice.setActivityId(citing.getId());
                notice.setActivityName(citing.getActivityName());
                notice.setEvidenceId(evidence.getId());
                notice.setEvidenceName(evidence.getOriginalFileName());
                notice.setCreatedAt(now);
                notificationRepository.save(notice);
            }
            emailReferenced(recipients, evidence.getOriginalFileName(), evidence.getId(),
                    citing.getActivityName(), actor == null ? null : actor.getName(), actorUnit);
        });
    }

    /** Another unit stopped citing this evidence. In-app only. */
    @Transactional
    public void notifyReferenceRemoved(EvidenceReference ref, User actor) {
        if (ref == null) return;
        safely("reference removal", () -> {
            Evidence evidence = ref.getEvidence();
            Activity citing = ref.getActivity();
            String actorUnit = actorUnit(ref, actor);
            OffsetDateTime now = OffsetDateTime.now(clock);
            for (User recipient : recipientsIn(ownerUnits(evidence), actor)) {
                UserNotification notice = base(recipient, UserNotificationType.REFERENCE_REMOVED, actor);
                notice.setActorUnit(actorUnit);
                notice.setActivityId(citing.getId());
                notice.setActivityName(citing.getActivityName());
                notice.setEvidenceId(evidence.getId());
                notice.setEvidenceName(evidence.getOriginalFileName());
                notice.setCreatedAt(now);
                notificationRepository.save(notice);
            }
        });
    }

    // ---------------------------------------------------------------- reading

    @Transactional
    public UserNotificationListResponse list(UUID userId) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        notificationRepository.deleteReadBefore(userId, now.minus(READ_RETENTION));

        List<UserNotification> rows = notificationRepository.findTop100ByRecipientIdOrderByCreatedAtDesc(userId);

        Set<UUID> evidenceIds = rows.stream().map(UserNotification::getEvidenceId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Set<UUID> activityIds = rows.stream().map(UserNotification::getActivityId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Set<UUID> liveEvidence = evidenceRepository.findAllById(evidenceIds).stream()
                .map(Evidence::getId).collect(Collectors.toSet());
        Set<UUID> liveActivities = activityRepository.findAllById(activityIds).stream()
                .map(Activity::getId).collect(Collectors.toSet());

        List<UserNotificationResponse> notifications = rows.stream()
                .map(n -> new UserNotificationResponse(
                        n.getId(), n.getType().name(), n.getActorName(), n.getActorUnit(),
                        n.getActivityId(), n.getActivityName(), n.getEvidenceId(), n.getEvidenceName(),
                        n.getVersionNumber(), n.getItemCount(), n.getCreatedAt(), n.getReadAt() != null,
                        n.getActivityId() != null && liveActivities.contains(n.getActivityId()),
                        n.getEvidenceId() != null && liveEvidence.contains(n.getEvidenceId())))
                .toList();
        return new UserNotificationListResponse(
                (int) notificationRepository.countByRecipientIdAndReadAtIsNull(userId), notifications);
    }

    @Transactional
    public void markRead(UUID id, UUID userId) {
        UserNotification notice = notificationRepository.findByIdAndRecipientId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (notice.getReadAt() == null) {
            notice.setReadAt(OffsetDateTime.now(clock));
            notificationRepository.save(notice);
        }
    }

    @Transactional
    public void markAllRead(UUID userId) {
        notificationRepository.markAllRead(userId, OffsetDateTime.now(clock));
    }

    // ---------------------------------------------------------------- who is told

    // Departments and offices an activity belongs to (uppercase, as users' own office is compared).
    private Set<String> unitsOf(Activity activity) {
        Set<String> units = new LinkedHashSet<>();
        if (activity == null) return units;
        if (activity.getDepartment() != null) units.add(activity.getDepartment().name().toUpperCase(Locale.ROOT));
        if (activity.getOffice() != null && !activity.getOffice().isBlank()) {
            units.add(activity.getOffice().trim().toUpperCase(Locale.ROOT));
        }
        return units;
    }

    // Tags are RelatedOffice values. An office tag has the same name as the office users belong to;
    // a college tag also means the department users belong to (same pairs as EvidenceAccessService).
    private static final Map<RelatedOffice, Department> TAG_DEPARTMENTS = Map.of(
            RelatedOffice.COLLEGE_OF_COMPUTER_STUDIES, Department.CCS,
            RelatedOffice.COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE, Department.CEA,
            RelatedOffice.COLLEGE_OF_NURSING, Department.CNAHS,
            RelatedOffice.COLLEGE_OF_MANAGEMENT_BUSINESS_AND_ACCOUNTANCY, Department.CMBA,
            RelatedOffice.COLLEGE_OF_ARTS_AND_SCIENCES, Department.CASE,
            RelatedOffice.COLLEGE_OF_CRIMINAL_JUSTICE, Department.CCJ
    );

    private Set<String> unitsOf(RelatedOffice tag) {
        Set<String> units = new LinkedHashSet<>();
        units.add(tag.name());
        Department department = TAG_DEPARTMENTS.get(tag);
        if (department != null) units.add(department.name());
        return units;
    }

    // Who owns evidence: the unit of its activity, and the unit of whoever uploaded it. This is the
    // same test EvidenceAccessService uses for "may modify / share".
    private Set<String> ownerUnits(Evidence evidence) {
        Set<String> units = unitsOf(evidence.getActivity());
        User uploader = evidence.getUploadedBy();
        if (uploader != null && uploader.getOffice() != null && !uploader.getOffice().isBlank()) {
            units.add(uploader.getOffice().trim().toUpperCase(Locale.ROOT));
        }
        return units;
    }

    private List<User> recipientsIn(Set<String> units, User actor) {
        if (units.isEmpty()) return List.of();
        return userRepository.findActiveInUnits(NOTIFIED_ROLES, units).stream()
                .filter(u -> actor == null || !u.getId().equals(actor.getId()))
                .toList();
    }

    private UserNotification base(User recipient, UserNotificationType type, User actor) {
        UserNotification notice = new UserNotification();
        notice.setRecipient(recipient);
        notice.setType(type);
        if (actor != null) {
            notice.setActorId(actor.getId());
            notice.setActorName(actor.getName());
            notice.setActorUnit(actor.getOffice());
        }
        return notice;
    }

    private String actorUnit(EvidenceReference ref, User actor) {
        String unit = ref.getReferencedByOffice();
        if (unit == null || unit.isBlank()) unit = actor == null ? null : actor.getOffice();
        return unit;
    }

    // ---------------------------------------------------------------- email

    // Sent after the reference is committed (so a rolled-back reference sends nothing), off the
    // request thread, and one failure never stops the others.
    private void emailReferenced(List<User> recipients, String evidenceName, UUID evidenceId,
                                 String citingActivity, String actorName, String actorUnit) {
        if (recipients.isEmpty()) return;
        List<User> toEmail = recipients.stream().limit(MAX_EMAILS_PER_REFERENCE).toList();
        Runnable send = () -> CompletableFuture.runAsync(() -> {
            for (User recipient : toEmail) {
                try {
                    emailService.sendEvidenceReferenced(recipient, evidenceName, evidenceId,
                            citingActivity, actorName, actorUnit);
                } catch (RuntimeException e) {
                    log.warn("Could not email a reference notice to {}: {}", recipient.getEmail(), e.toString());
                }
            }
        });
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }

    private void safely(String what, Runnable action) {
        try {
            action.run();
        } catch (RuntimeException e) {
            log.warn("Could not write {} notifications: {}", what, e.toString(), e);
        }
    }
}

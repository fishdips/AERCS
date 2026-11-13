package com.aercs.service;

import com.aercs.dto.response.AccreditorNotificationListResponse;
import com.aercs.dto.response.AccreditorNotificationResponse;
import com.aercs.entity.AccreditorAccess;
import com.aercs.entity.AccreditorNotification;
import com.aercs.entity.AccreditorNotificationType;
import com.aercs.entity.User;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.AccreditorAccessRepository;
import com.aercs.repository.AccreditorNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * The accreditor's notifications section: being shared a link, and links about to expire.
 *
 * <p>"Shared" notices are written when staff share (or add the accreditor to) a link. Expiry
 * notices are created on demand, the first time the accreditor's page asks after a link has come
 * within 24 hours (and again within 4 hours) of its expiry. There is no background job: the notices
 * only matter while someone is looking, and nothing can then be missed or sent twice.
 */
@Service
@RequiredArgsConstructor
public class AccreditorNotificationService {

    private static final Logger log = LoggerFactory.getLogger(AccreditorNotificationService.class);

    static final Duration FIRST_WARNING = Duration.ofHours(24);
    static final Duration FINAL_WARNING = Duration.ofHours(4);
    private static final int MAX_SHOWN = 50;

    private final AccreditorNotificationRepository notificationRepository;
    private final AccreditorAccessRepository accessRepository;
    private final AccreditorNotificationWriter writer;
    private final Clock clock;

    /**
     * Tells each accreditor that {@code access} was shared with them. If they were shared the same
     * link before (and removed from it since), their existing notice is made new again rather than
     * adding a second one that would read as a duplicate.
     */
    @Transactional
    public void notifyShared(AccreditorAccess access, Collection<User> accreditors) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        for (User accreditor : accreditors) {
            AccreditorNotification notice = notificationRepository
                    .findFirstByAccreditorIdAndAccessIdAndType(
                            accreditor.getId(), access.getId(), AccreditorNotificationType.SHARED)
                    .orElseGet(() -> {
                        AccreditorNotification created = new AccreditorNotification();
                        created.setAccreditor(accreditor);
                        created.setAccess(access);
                        created.setType(AccreditorNotificationType.SHARED);
                        return created;
                    });
            notice.setCreatedAt(now);
            notice.setReadAt(null);
            notificationRepository.save(notice);
        }
    }

    @Transactional(readOnly = true)
    public AccreditorNotificationListResponse list(UUID accreditorId) {
        createDueExpiryNotices(accreditorId);

        List<AccreditorNotification> current = notificationRepository.findVisibleForAccreditor(accreditorId).stream()
                .filter(this::isCurrent)
                .toList();
        int unread = (int) current.stream().filter(n -> n.getReadAt() == null).count();
        return new AccreditorNotificationListResponse(
                unread,
                current.stream().limit(MAX_SHOWN).map(this::toResponse).toList());
    }

    @Transactional
    public void markRead(UUID notificationId, UUID accreditorId) {
        AccreditorNotification notice = notificationRepository.findByIdAndAccreditorId(notificationId, accreditorId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (notice.getReadAt() == null) {
            notice.setReadAt(OffsetDateTime.now(clock));
        }
    }

    @Transactional
    public void markAllRead(UUID accreditorId) {
        notificationRepository.markAllRead(accreditorId, OffsetDateTime.now(clock));
    }

    // For each still-open link within 24 hours of expiring, make sure the matching notice exists:
    // the 4-hour one once inside 4 hours, otherwise the 24-hour one. Doing this repeatedly is safe.
    private void createDueExpiryNotices(UUID accreditorId) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        // Open links come back soonest-expiring first, so we can stop at the first one beyond 24 hours.
        for (AccreditorAccess link : accessRepository.findOpenLinksForAccreditor(accreditorId, now)) {
            Duration remaining = Duration.between(now, link.getExpiresAt());
            if (remaining.compareTo(FIRST_WARNING) > 0) {
                break;
            }
            AccreditorNotificationType type = remaining.compareTo(FINAL_WARNING) <= 0
                    ? AccreditorNotificationType.EXPIRING_4H
                    : AccreditorNotificationType.EXPIRING_24H;
            try {
                writer.ensureExpiryNotice(accreditorId, link.getId(), type, link.getExpiresAt());
            } catch (DataIntegrityViolationException e) {
                log.debug("Expiry notice for link {} was created by a concurrent request", link.getId());
            }
        }
    }

    // An expiry notice only counts while the link still expires when it said it would. If staff
    // extended the link afterwards, the warning is out of date and is hidden (a fresh one is
    // created when the new expiry comes within range).
    private boolean isCurrent(AccreditorNotification notice) {
        if (notice.getType() == AccreditorNotificationType.SHARED) {
            return true;
        }
        OffsetDateTime warned = notice.getExpiresAtSnapshot();
        OffsetDateTime actual = notice.getAccess().getExpiresAt();
        return warned != null
                && warned.toInstant().truncatedTo(ChronoUnit.SECONDS)
                        .equals(actual.toInstant().truncatedTo(ChronoUnit.SECONDS));
    }

    private AccreditorNotificationResponse toResponse(AccreditorNotification notice) {
        AccreditorAccess link = notice.getAccess();
        String activityName = link.getActivity() == null ? null : link.getActivity().getActivityName();
        String linkName = link.getName() != null && !link.getName().isBlank()
                ? link.getName()
                : (activityName != null ? activityName : "Evidence link");
        return new AccreditorNotificationResponse(
                notice.getId(),
                notice.getType().name(),
                notice.getCreatedAt(),
                notice.getReadAt() != null,
                link.getId(),
                linkName,
                activityName,
                link.getCreatedBy() == null ? null : link.getCreatedBy().getName(),
                link.getExpiresAt()
        );
    }
}

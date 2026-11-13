package com.aercs.service;

import com.aercs.entity.AccreditorNotification;
import com.aercs.entity.AccreditorNotificationType;
import com.aercs.repository.AccreditorAccessRepository;
import com.aercs.repository.AccreditorNotificationRepository;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Writes one expiry notice in its own transaction. If two requests (say, two open tabs) try to
 * create the same notice at once, the database's unique constraint stops the second one; living in
 * its own transaction means that failure rolls back only that insert and the caller carries on.
 */
@Component
@RequiredArgsConstructor
public class AccreditorNotificationWriter {

    private final AccreditorNotificationRepository notificationRepository;
    private final AccreditorAccessRepository accessRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureExpiryNotice(UUID accreditorId, UUID accessId,
                                   AccreditorNotificationType type, OffsetDateTime expiresAt) {
        if (notificationRepository.existsByAccreditorIdAndAccessIdAndTypeAndExpiresAtSnapshot(
                accreditorId, accessId, type, expiresAt)) {
            return;
        }
        AccreditorNotification notice = new AccreditorNotification();
        notice.setAccreditor(userRepository.getReferenceById(accreditorId));
        notice.setAccess(accessRepository.getReferenceById(accessId));
        notice.setType(type);
        notice.setExpiresAtSnapshot(expiresAt);
        notice.setCreatedAt(OffsetDateTime.now(clock));
        notificationRepository.saveAndFlush(notice);
    }
}

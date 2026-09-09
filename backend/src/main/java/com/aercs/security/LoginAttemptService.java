package com.aercs.security;

import com.aercs.exception.AccountLockedException;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// In-memory brute-force guard on /api/auth/login, keyed by email. Simple and
// dependency-free, appropriate for this app's scale (tens of users, one
// instance) - a real rate-limiting library would be overkill here.
@Component
public class LoginAttemptService {

    private static final int MAX_ATTEMPTS = 5;
    private static final Duration LOCKOUT_DURATION = Duration.ofMinutes(15);

    private record Attempts(int count, Instant lockedUntil) {}

    private final Map<String, Attempts> attemptsByEmail = new ConcurrentHashMap<>();

    public void checkNotLocked(String email) {
        Attempts attempts = attemptsByEmail.get(normalize(email));
        if (attempts == null || attempts.lockedUntil() == null) return;

        Instant now = Instant.now();
        if (now.isBefore(attempts.lockedUntil())) {
            long minutesLeft = Math.max(1, Duration.between(now, attempts.lockedUntil()).toMinutes());
            throw new AccountLockedException(
                    "Too many failed login attempts. Try again in " + minutesLeft + " minute(s).");
        }
    }

    public void recordFailure(String email) {
        attemptsByEmail.compute(normalize(email), (key, current) -> {
            int count = (current == null ? 0 : current.count()) + 1;
            Instant lockedUntil = count >= MAX_ATTEMPTS ? Instant.now().plus(LOCKOUT_DURATION) : null;
            return new Attempts(count, lockedUntil);
        });
    }

    public void recordSuccess(String email) {
        attemptsByEmail.remove(normalize(email));
    }

    private String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}

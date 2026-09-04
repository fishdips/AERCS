package com.aercs.service;

import com.aercs.dto.response.AuthMeResponse;
import com.aercs.entity.User;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.UserRepository;
import com.aercs.security.JwtUtil;
import com.aercs.security.LoginAttemptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int RESET_TOKEN_BYTES = 32;

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final LoginAttemptService loginAttemptService;
    private final InvitationEmailService invitationEmailService;

    public String login(String email, String password) {
        loginAttemptService.checkNotLocked(email);

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, password)
            );
        } catch (AuthenticationException e) {
            loginAttemptService.recordFailure(email);
            throw e;
        }
        loginAttemptService.recordSuccess(email);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return jwtUtil.generateToken(user);
    }

    public AuthMeResponse getMe(String userId) {
        User user = findUserById(userId);
        return toAuthMeResponse(user);
    }

    @Transactional
    public String changePassword(String userId, String currentPassword, String newPassword) {
        User user = findUserById(userId);

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }

        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new BadRequestException("New password must be different from the current password");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePw(false);
        userRepository.save(user);

        return jwtUtil.generateToken(user);
    }

    @Transactional
    public void forgotPassword(String email, String frontendOrigin) {
        // Always behaves the same way regardless of whether the email exists,
        // and swallows send failures internally (logged, not thrown) - a public,
        // unauthenticated endpoint must not let a caller distinguish "no such
        // account" from "mail is misconfigured" from "account exists".
        userRepository.findByEmail(email).ifPresent(user -> {
            String token = generateResetToken();
            user.setResetToken(token);
            user.setResetTokenExpiresAt(OffsetDateTime.now().plusHours(1));
            userRepository.save(user);

            String resetUrl = normalizeFrontendOrigin(frontendOrigin) + "/reset-password/" + token;
            try {
                invitationEmailService.sendPasswordReset(user, resetUrl);
            } catch (RuntimeException e) {
                log.warn("Failed to send password reset email to {}", user.getEmail(), e);
            }
        });
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        User user = userRepository.findByResetToken(token)
                .orElseThrow(() -> new BadRequestException("Invalid or expired reset link"));

        if (user.getResetTokenExpiresAt() == null || user.getResetTokenExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new BadRequestException("Invalid or expired reset link");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePw(false);
        user.setResetToken(null);
        user.setResetTokenExpiresAt(null);
        userRepository.save(user);
    }

    private String generateResetToken() {
        byte[] bytes = new byte[RESET_TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String normalizeFrontendOrigin(String frontendOrigin) {
        if (frontendOrigin == null || frontendOrigin.isBlank()) {
            return "http://localhost:3000";
        }
        return frontendOrigin.replaceAll("/+$", "");
    }

    private User findUserById(String userId) {
        return userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private AuthMeResponse toAuthMeResponse(User user) {
        return new AuthMeResponse(
                user.getId(),
                user.getName(),
                user.getRole().name(),
                user.getOffice(),
                user.isMustChangePw()
        );
    }
}

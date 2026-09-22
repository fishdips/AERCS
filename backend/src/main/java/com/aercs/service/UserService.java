package com.aercs.service;

import com.aercs.dto.request.BatchCreateUserRequest;
import com.aercs.dto.request.CreateUserRequest;
import com.aercs.dto.response.BatchCreateUserResult;
import com.aercs.dto.response.CreateUserResponse;
import com.aercs.dto.response.UserResponse;
import com.aercs.entity.Department;
import com.aercs.entity.Office;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.InvitationEmailException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final InvitationEmailService invitationEmailService;

    // Self-injected proxy so createUsers() -> createUser() goes through Spring's
    // transaction interceptor per invite, instead of bypassing it via a plain
    // internal method call (self-invocation does not trigger @Transactional).
    @Autowired
    @Lazy
    private UserService self;

    @Transactional
    public CreateUserResponse createUser(CreateUserRequest request, String adminId) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BadRequestException("A user with this email already exists");
        }

        UserRole role;
        try {
            role = UserRole.valueOf(request.role());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid role: " + request.role());
        }

        validateOffice(request.office());

        String tempPassword = generateTempPassword();

        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setOffice(request.office());
        user.setRole(role);
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setActive(true);
        user.setMustChangePw(true);

        userRepository.findById(UUID.fromString(adminId)).ifPresent(user::setCreatedBy);

        User saved = userRepository.save(user);
        invitationEmailService.sendInvitation(saved, tempPassword);
        return toCreateUserResponse(saved);
    }

    public List<BatchCreateUserResult> createUsers(BatchCreateUserRequest request, String adminId) {
        List<BatchCreateUserResult> results = new ArrayList<>();
        for (BatchCreateUserRequest.Invite invite : request.users()) {
            CreateUserRequest singleRequest = new CreateUserRequest(
                    invite.name(), invite.email(), request.office(), request.role());
            try {
                CreateUserResponse created = self.createUser(singleRequest, adminId);
                results.add(new BatchCreateUserResult(invite.email(), true, created, null));
            } catch (BadRequestException | InvitationEmailException e) {
                results.add(new BatchCreateUserResult(invite.email(), false, null, e.getMessage()));
            }
        }
        return results;
    }

    public List<UserResponse> listUsers() {
        return userRepository.findAll().stream()
                .map(this::toUserResponse)
                .toList();
    }

    @Transactional
    public UserResponse updateRole(UUID userId, String newRole) {
        User user = findUserById(userId);

        UserRole role;
        try {
            role = UserRole.valueOf(newRole);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid role: " + newRole);
        }

        user.setRole(role);
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse updateStatus(UUID userId, boolean active) {
        User user = findUserById(userId);
        user.setActive(active);
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse updateOffice(UUID userId, String office) {
        User user = findUserById(userId);
        validateOffice(office);
        user.setOffice(office);
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse updateProfile(UUID userId, String name, String email) {
        User user = findUserById(userId);

        if (!user.getEmail().equalsIgnoreCase(email) && userRepository.existsByEmail(email)) {
            throw new BadRequestException("A user with this email already exists");
        }

        user.setName(name);
        user.setEmail(email);
        return toUserResponse(userRepository.save(user));
    }

    // Issues a fresh temporary password and re-sends the invitation-style email -
    // covers both "resend a lost invite" and "reset this user's password" from
    // the admin's point of view. Bumps the token version so any session issued
    // with the old password is logged out immediately.
    @Transactional
    public UserResponse resetUserPassword(UUID userId) {
        User user = findUserById(userId);

        String tempPassword = generateTempPassword();
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setMustChangePw(true);
        user.setTokenVersion(user.getTokenVersion() + 1);
        User saved = userRepository.save(user);

        invitationEmailService.sendAdminPasswordReset(saved, tempPassword);
        return toUserResponse(saved);
    }

    // Invalidates every outstanding JWT for this user (they'll be signed out on
    // their next request) without touching their password or active status.
    @Transactional
    public UserResponse revokeSessions(UUID userId, String requestingAdminId) {
        if (userId.equals(UUID.fromString(requestingAdminId))) {
            throw new BadRequestException("You cannot force logout your own account");
        }
        User user = findUserById(userId);
        user.setTokenVersion(user.getTokenVersion() + 1);
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(UUID userId, String requestingAdminId) {
        if (userId.equals(UUID.fromString(requestingAdminId))) {
            throw new BadRequestException("You cannot delete your own account");
        }
        User user = findUserById(userId);
        userRepository.delete(user);
    }

    private User findUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private void validateOffice(String office) {
        if (office == null) return;
        boolean isDepartment = Arrays.stream(Department.values()).anyMatch(d -> d.name().equals(office));
        boolean isOffice = Arrays.stream(Office.values()).anyMatch(o -> o.name().equals(office));
        if (!isDepartment && !isOffice) {
            throw new BadRequestException("Invalid department/office value: " + office);
        }
    }

    private String generateTempPassword() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.getOffice(),
                user.isActive(),
                user.isMustChangePw(),
                user.getCreatedAt()
        );
    }

    private CreateUserResponse toCreateUserResponse(User user) {
        return new CreateUserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.getOffice(),
                user.isActive(),
                user.isMustChangePw()
        );
    }
}

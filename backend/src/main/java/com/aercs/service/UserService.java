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
import com.aercs.exception.ForbiddenException;
import com.aercs.exception.InvitationEmailException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.AccreditorAccessRepository;
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
    private final AccreditorAccessRepository accreditorAccessRepository;
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

        User caller = adminId != null ? userRepository.findByIdentifier(adminId).orElse(null) : null;
        String targetOffice = request.office();

        if (caller != null && caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            if (role != UserRole.DEPT_STAFF && role != UserRole.ACCRED_COORDINATOR && role != UserRole.ACCREDITOR_LINK) {
                throw new ForbiddenException("Chairpersons can only assign Department Staff, Chairperson, or Accreditor roles");
            }
            if (caller.getOffice() == null || caller.getOffice().isBlank()) {
                throw new BadRequestException("Chairperson must have an assigned department");
            }
            targetOffice = caller.getOffice();
        }

        validateOffice(targetOffice);

        String tempPassword = generateTempPassword();

        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setOffice(targetOffice);
        user.setRole(role);
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setActive(true);
        user.setMustChangePw(true);

        if (caller != null) {
            user.setCreatedBy(caller);
        }

        User saved = userRepository.save(user);
        invitationEmailService.sendInvitation(saved, tempPassword);
        return toCreateUserResponse(saved);
    }

    public List<BatchCreateUserResult> createUsers(BatchCreateUserRequest request, String adminId) {
        User caller = adminId != null ? userRepository.findByIdentifier(adminId).orElse(null) : null;
        String effectiveOffice = request.office();
        if (caller != null && caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            UserRole targetRole;
            try {
                targetRole = UserRole.valueOf(request.role());
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Invalid role: " + request.role());
            }
            if (targetRole != UserRole.DEPT_STAFF && targetRole != UserRole.ACCRED_COORDINATOR && targetRole != UserRole.ACCREDITOR_LINK) {
                throw new ForbiddenException("Chairpersons can only assign Department Staff, Chairperson, or Accreditor roles");
            }
            if (caller.getOffice() == null || caller.getOffice().isBlank()) {
                throw new BadRequestException("Chairperson must have an assigned department");
            }
            effectiveOffice = caller.getOffice();
        }

        List<BatchCreateUserResult> results = new ArrayList<>();
        for (BatchCreateUserRequest.Invite invite : request.users()) {
            CreateUserRequest singleRequest = new CreateUserRequest(
                    invite.name(), invite.email(), effectiveOffice, request.role());
            try {
                CreateUserResponse created = self.createUser(singleRequest, adminId);
                results.add(new BatchCreateUserResult(invite.email(), true, created, null));
            } catch (BadRequestException | ForbiddenException | InvitationEmailException e) {
                results.add(new BatchCreateUserResult(invite.email(), false, null, e.getMessage()));
            }
        }
        return results;
    }

    public List<UserResponse> listUsers() {
        return listUsers(null);
    }

    public List<UserResponse> listUsers(String callerIdentifier) {
        if (callerIdentifier == null) {
            return userRepository.findAll().stream()
                    .map(this::toUserResponse)
                    .toList();
        }
        User caller = userRepository.findByIdentifier(callerIdentifier)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (caller.getRole() == UserRole.ADMIN) {
            return userRepository.findAll().stream()
                    .map(this::toUserResponse)
                    .toList();
        }
        if (caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            String chairOffice = caller.getOffice();
            return userRepository.findAll().stream()
                    .filter(u -> (chairOffice != null && u.getOffice() != null && chairOffice.equalsIgnoreCase(u.getOffice()))
                            || (u.getCreatedBy() != null && u.getCreatedBy().getId().equals(caller.getId())))
                    .map(this::toUserResponse)
                    .toList();
        }
        throw new ForbiddenException("Access denied");
    }

    @Transactional
    public UserResponse updateRole(UUID userId, String newRole, String callerId) {
        User caller = callerId != null ? userRepository.findByIdentifier(callerId).orElse(null) : null;
        User user = findUserById(userId);

        if (caller != null && caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            assertChairpersonCanManageUser(caller, user);
        }

        UserRole role;
        try {
            role = UserRole.valueOf(newRole);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid role: " + newRole);
        }

        if (caller != null && caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            if (role != UserRole.DEPT_STAFF && role != UserRole.ACCRED_COORDINATOR && role != UserRole.ACCREDITOR_LINK) {
                throw new ForbiddenException("Chairpersons can only assign Department Staff, Chairperson, or Accreditor roles");
            }
        }

        // An account that stops being an accreditor loses every link assigned to it.
        if (user.getRole() == UserRole.ACCREDITOR_LINK && role != UserRole.ACCREDITOR_LINK) {
            accreditorAccessRepository.removeAccreditorFromAllLinks(user.getId());
        }
        user.setRole(role);
        return toUserResponse(userRepository.save(user));
    }

    public UserResponse updateRole(UUID userId, String newRole) {
        return updateRole(userId, newRole, null);
    }

    @Transactional
    public UserResponse updateStatus(UUID userId, boolean active, String callerId) {
        User caller = callerId != null ? userRepository.findByIdentifier(callerId).orElse(null) : null;
        User user = findUserById(userId);
        if (caller != null && caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            assertChairpersonCanManageUser(caller, user);
        }
        user.setActive(active);
        return toUserResponse(userRepository.save(user));
    }

    public UserResponse updateStatus(UUID userId, boolean active) {
        return updateStatus(userId, active, null);
    }

    @Transactional
    public UserResponse updateOffice(UUID userId, String office, String callerId) {
        User caller = callerId != null ? userRepository.findByIdentifier(callerId).orElse(null) : null;
        User user = findUserById(userId);
        if (caller != null && caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            assertChairpersonCanManageUser(caller, user);
            if (office == null || caller.getOffice() == null || !office.equalsIgnoreCase(caller.getOffice())) {
                throw new ForbiddenException("Chairpersons can only assign users to their own department");
            }
        }
        validateOffice(office);
        user.setOffice(office);
        return toUserResponse(userRepository.save(user));
    }

    public UserResponse updateOffice(UUID userId, String office) {
        return updateOffice(userId, office, null);
    }

    @Transactional
    public UserResponse updateProfile(UUID userId, String name, String email, String callerId) {
        User caller = callerId != null ? userRepository.findByIdentifier(callerId).orElse(null) : null;
        User user = findUserById(userId);
        if (caller != null && caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            assertChairpersonCanManageUser(caller, user);
        }

        if (!user.getEmail().equalsIgnoreCase(email) && userRepository.existsByEmail(email)) {
            throw new BadRequestException("A user with this email already exists");
        }

        user.setName(name);
        user.setEmail(email);
        return toUserResponse(userRepository.save(user));
    }

    public UserResponse updateProfile(UUID userId, String name, String email) {
        return updateProfile(userId, name, email, null);
    }

    // Issues a fresh temporary password and re-sends the invitation-style email -
    // covers both "resend a lost invite" and "reset this user's password" from
    // the admin's point of view. Bumps the token version so any session issued
    // with the old password is logged out immediately.
    @Transactional
    public UserResponse resetUserPassword(UUID userId, String callerId) {
        User caller = callerId != null ? userRepository.findByIdentifier(callerId).orElse(null) : null;
        User user = findUserById(userId);
        if (caller != null && caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            assertChairpersonCanManageUser(caller, user);
        }

        String tempPassword = generateTempPassword();
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setMustChangePw(true);
        user.setTokenVersion(user.getTokenVersion() + 1);
        User saved = userRepository.save(user);

        invitationEmailService.sendAdminPasswordReset(saved, tempPassword);
        return toUserResponse(saved);
    }

    public UserResponse resetUserPassword(UUID userId) {
        return resetUserPassword(userId, null);
    }

    // Invalidates every outstanding JWT for this user (they'll be signed out on
    // their next request) without touching their password or active status.
    @Transactional
    public UserResponse revokeSessions(UUID userId, String requestingAdminId) {
        User caller = requestingAdminId != null ? userRepository.findByIdentifier(requestingAdminId).orElse(null) : null;
        if (caller != null && userId.equals(caller.getId())) {
            throw new BadRequestException("You cannot force logout your own account");
        }
        User user = findUserById(userId);
        if (caller != null && caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            assertChairpersonCanManageUser(caller, user);
        }
        user.setTokenVersion(user.getTokenVersion() + 1);
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(UUID userId, String requestingAdminId) {
        User caller = requestingAdminId != null ? userRepository.findByIdentifier(requestingAdminId).orElse(null) : null;
        if (caller != null && userId.equals(caller.getId())) {
            throw new BadRequestException("You cannot delete your own account");
        }
        User user = findUserById(userId);
        if (caller != null && caller.getRole() == UserRole.ACCRED_COORDINATOR) {
            assertChairpersonCanManageUser(caller, user);
        }
        accreditorAccessRepository.removeAccreditorFromAllLinks(user.getId());
        userRepository.delete(user);
    }

    private void assertChairpersonCanManageUser(User chairperson, User targetUser) {
        if (chairperson == null || chairperson.getRole() != UserRole.ACCRED_COORDINATOR) {
            return;
        }
        if (targetUser.getRole() == UserRole.ADMIN) {
            throw new ForbiddenException("Chairpersons cannot manage Administrator accounts");
        }
        String chairOffice = chairperson.getOffice();
        boolean sameOffice = chairOffice != null && targetUser.getOffice() != null
                && chairOffice.equalsIgnoreCase(targetUser.getOffice());
        boolean createdByChair = targetUser.getCreatedBy() != null
                && targetUser.getCreatedBy().getId().equals(chairperson.getId());
        if (!sameOffice && !createdByChair) {
            throw new ForbiddenException("Chairpersons can only manage users within their own department");
        }
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

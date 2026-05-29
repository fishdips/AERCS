package com.aercs.service;

import com.aercs.dto.request.CreateUserRequest;
import com.aercs.dto.response.CreateUserResponse;
import com.aercs.dto.response.UserResponse;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

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

        String tempPassword = generateTempPassword();

        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setDepartment(request.department());
        user.setOffice(request.office());
        user.setRole(role);
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setActive(true);
        user.setMustChangePw(true);

        userRepository.findById(UUID.fromString(adminId)).ifPresent(user::setCreatedBy);

        User saved = userRepository.save(user);
        return toCreateUserResponse(saved, tempPassword);
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
                user.getDepartment() != null ? user.getDepartment().name() : null,
                user.getOffice() != null ? user.getOffice().name() : null,
                user.isActive(),
                user.isMustChangePw(),
                user.getCreatedAt()
        );
    }

    private CreateUserResponse toCreateUserResponse(User user, String tempPassword) {
        return new CreateUserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.getDepartment() != null ? user.getDepartment().name() : null,
                user.getOffice() != null ? user.getOffice().name() : null,
                user.isActive(),
                user.isMustChangePw(),
                tempPassword
        );
    }
}

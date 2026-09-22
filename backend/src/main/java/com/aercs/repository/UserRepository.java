package com.aercs.repository;

import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByResetToken(String resetToken);

    boolean existsByEmail(String email);

    boolean existsByRole(UserRole role);

    default Optional<User> findByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }
        try {
            UUID uuid = UUID.fromString(identifier.trim());
            Optional<User> userByUuid = findById(uuid);
            if (userByUuid.isPresent()) {
                return userByUuid;
            }
        } catch (IllegalArgumentException ignored) {
        }
        return findByEmail(identifier.trim());
    }
}


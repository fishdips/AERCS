package com.aercs.config;

import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @EventListener(ApplicationReadyEvent.class)
    public void seedAdmin() {
        if (userRepository.existsByRole(UserRole.ADMIN)) {
            return;
        }

        String tempPassword = generateTempPassword();

        User admin = new User();
        admin.setName("System Administrator");
        admin.setEmail("admin@aercs.edu.ph");
        admin.setPasswordHash(passwordEncoder.encode(tempPassword));
        admin.setRole(UserRole.ADMIN);
        admin.setActive(true);
        admin.setMustChangePw(true);

        userRepository.save(admin);

        log.warn("=========================================================");
        log.warn("  AERCS DEFAULT ADMIN ACCOUNT CREATED");
        log.warn("  Email    : admin@aercs.edu.ph");
        log.warn("  Password : {}", tempPassword);
        log.warn("  Change this password immediately after first login.");
        log.warn("=========================================================");
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
}

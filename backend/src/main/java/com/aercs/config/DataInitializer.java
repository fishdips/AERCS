package com.aercs.config;

import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void initDatabase() {
        updateDatabaseConstraints();
        seedAdmin();
    }

    private void updateDatabaseConstraints() {
        try {
            // Drop any legacy or auto-generated check constraints on users
            jdbcTemplate.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_office;");
            jdbcTemplate.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_office_check;");
            jdbcTemplate.execute("ALTER TABLE users ADD CONSTRAINT chk_users_office CHECK (office IS NULL OR LENGTH(TRIM(office)) BETWEEN 1 AND 100);");

            // Drop any legacy or auto-generated check constraints on activities
            jdbcTemplate.execute("ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_activity_type;");
            jdbcTemplate.execute("ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;");
            jdbcTemplate.execute("ALTER TABLE activities ADD CONSTRAINT chk_activities_activity_type CHECK (activity_type IN ('SEMINAR', 'TRAINING', 'WORKSHOP', 'RESEARCH', 'EXTENSION', 'OUTREACH', 'MEETING', 'CONFERENCE', 'WEBINAR', 'ADMINISTRATIVE', 'OTHER'));");

            jdbcTemplate.execute("ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_department;");
            jdbcTemplate.execute("ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_department_check;");
            jdbcTemplate.execute("ALTER TABLE activities ADD CONSTRAINT chk_activities_department CHECK (department IS NULL OR LENGTH(TRIM(department)) BETWEEN 1 AND 100);");

            jdbcTemplate.execute("ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_office;");
            jdbcTemplate.execute("ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_office_check;");
            jdbcTemplate.execute("ALTER TABLE activities ADD CONSTRAINT chk_activities_office CHECK (office IS NULL OR LENGTH(TRIM(office)) BETWEEN 1 AND 100);");

            jdbcTemplate.execute("ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_accreditation_area;");
            jdbcTemplate.execute("ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_accreditation_area_check;");

            jdbcTemplate.execute("ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_department_or_office;");
            jdbcTemplate.execute("ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_department_or_office_check;");
            jdbcTemplate.execute("ALTER TABLE activities ADD CONSTRAINT chk_activities_department_or_office CHECK (NULLIF(TRIM(department), '') IS NOT NULL OR NULLIF(TRIM(office), '') IS NOT NULL);");

            log.info("Successfully updated database constraints for users and activities tables.");
        } catch (Exception e) {
            log.warn("Could not update database constraints: {}", e.getMessage());
        }
    }

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

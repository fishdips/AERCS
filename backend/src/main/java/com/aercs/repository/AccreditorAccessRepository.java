package com.aercs.repository;

import com.aercs.entity.AccreditorAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccreditorAccessRepository extends JpaRepository<AccreditorAccess, UUID> {

    Optional<AccreditorAccess> findByToken(String token);

    boolean existsByToken(String token);

    List<AccreditorAccess> findByActiveTrueAndExpiresAtBetween(OffsetDateTime from, OffsetDateTime to);

    List<AccreditorAccess> findByActiveTrueAndExpiresAtBetweenAndCreatedById(
            OffsetDateTime from, OffsetDateTime to, UUID createdById);
}

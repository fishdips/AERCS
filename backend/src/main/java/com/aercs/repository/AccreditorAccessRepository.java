package com.aercs.repository;

import com.aercs.entity.AccreditorAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccreditorAccessRepository extends JpaRepository<AccreditorAccess, UUID> {

    Optional<AccreditorAccess> findByToken(String token);

    boolean existsByToken(String token);
}

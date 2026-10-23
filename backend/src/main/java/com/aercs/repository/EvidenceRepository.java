package com.aercs.repository;

import com.aercs.entity.Evidence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EvidenceRepository extends JpaRepository<Evidence, UUID>, JpaSpecificationExecutor<Evidence> {

    List<Evidence> findByActivityIdOrderByUploadedAtDesc(UUID activityId);

    List<Evidence> findByActivityIdIn(List<UUID> activityIds);

    boolean existsByActivityId(UUID activityId);

    // Earliest matching upload is treated as "the original" that a duplicate should
    // point to, regardless of which office/department/activity it lives under.
    Optional<Evidence> findFirstByFileHashOrderByUploadedAtAsc(String fileHash);
}

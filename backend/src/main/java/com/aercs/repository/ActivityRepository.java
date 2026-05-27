package com.aercs.repository;

import com.aercs.entity.Activity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ActivityRepository extends JpaRepository<Activity, UUID> {

    @Query("SELECT a FROM Activity a WHERE LOWER(a.department) = LOWER(:department)")
    List<Activity> findByDepartmentIgnoreCase(@Param("department") String department);
}

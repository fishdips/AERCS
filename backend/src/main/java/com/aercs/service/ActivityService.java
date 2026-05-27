package com.aercs.service;

import com.aercs.dto.request.ActivityRequest;
import com.aercs.dto.response.ActivityResponse;
import com.aercs.entity.Activity;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.exception.BadRequestException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.ActivityRepository;
import com.aercs.repository.EvidenceRepository;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActivityService {

    private static final Set<String> ALLOWED_DEPARTMENTS = Set.of(
            "CEA",
            "CMBA",
            "CASE",
            "CNAHS",
            "CCS",
            "CCJ"
    );

    private static final Set<String> ALLOWED_OFFICES = Set.of(
            "Quality Assurance Office",
            "Research Office",
            "Extension Office",
            "Registrar\u2019s Office",
            "Library",
            "Student Affairs Office",
            "Facilities Management Office",
            "Human Resource Office"
    );

    private final ActivityRepository activityRepository;
    private final EvidenceRepository evidenceRepository;
    private final UserRepository userRepository;

    @Transactional
    public ActivityResponse createActivity(ActivityRequest request, String userId) {
        validateAllowedSelections(request);

        Activity activity = new Activity();
        applyRequest(activity, request);
        userRepository.findById(UUID.fromString(userId)).ifPresent(activity::setCreatedBy);

        return toResponse(activityRepository.save(activity));
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> listActivities(String userId) {
        User user = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (canViewAll(user.getRole())) {
            return activityRepository.findAll().stream().map(this::toResponse).toList();
        }

        if (user.getDepartment() == null) {
            return List.of();
        }

        return activityRepository.findByDepartmentIgnoreCase(user.getDepartment())
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ActivityResponse getActivity(UUID id, String userId) {
        Activity activity = findActivity(id);
        User user = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!canViewAll(user.getRole())) {
            if (user.getDepartment() == null || !user.getDepartment().equalsIgnoreCase(activity.getDepartment())) {
                throw new ResourceNotFoundException("Activity not found");
            }
        }

        return toResponse(activity);
    }

    private boolean canViewAll(UserRole role) {
        return role == UserRole.ADMIN
                || role == UserRole.ACCRED_COORDINATOR
                || role == UserRole.INSTITUTIONAL_OFFICE;
    }

    @Transactional
    public ActivityResponse updateActivity(UUID id, ActivityRequest request) {
        validateAllowedSelections(request);

        Activity activity = findActivity(id);
        applyRequest(activity, request);
        return toResponse(activityRepository.save(activity));
    }

    @Transactional
    public void deleteActivity(UUID id) {
        Activity activity = findActivity(id);
        if (evidenceRepository.existsByActivityId(id)) {
            throw new BadRequestException("Activity has attached evidence and cannot be deleted");
        }
        activityRepository.delete(activity);
    }

    private Activity findActivity(UUID id) {
        return activityRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Activity not found"));
    }

    private void validateAllowedSelections(ActivityRequest request) {
        if (isBlank(request.department()) && isBlank(request.office())) {
            throw new BadRequestException("Department or office is required");
        }
        if (!isBlank(request.department()) && !ALLOWED_DEPARTMENTS.contains(request.department().trim())) {
            throw new BadRequestException("Invalid department selected");
        }
        if (!isBlank(request.office()) && !ALLOWED_OFFICES.contains(request.office().trim())) {
            throw new BadRequestException("Invalid office selected");
        }
    }

    private void applyRequest(Activity activity, ActivityRequest request) {
        activity.setActivityName(request.activityName().trim());
        activity.setDescription(trimToNull(request.description()));
        activity.setActivityType(request.activityType());
        activity.setActivityDate(request.activityDate());
        activity.setDepartment(trimToNull(request.department()));
        activity.setOffice(trimToNull(request.office()));
        activity.setAccreditationArea(request.accreditationArea());
        activity.setAcademicYear(request.academicYear().trim());
    }

    private ActivityResponse toResponse(Activity activity) {
        User createdBy = activity.getCreatedBy();
        return new ActivityResponse(
                activity.getId(),
                activity.getActivityName(),
                activity.getDescription(),
                activity.getActivityType(),
                activity.getActivityDate(),
                activity.getDepartment(),
                activity.getOffice(),
                activity.getAccreditationArea(),
                activity.getAcademicYear(),
                createdBy == null ? null : createdBy.getId(),
                createdBy == null ? null : createdBy.getName(),
                createdBy == null ? null : createdBy.getRole().name(),
                activity.getCreatedAt(),
                activity.getUpdatedAt(),
                List.of()
        );
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String trimToNull(String value) {
        if (isBlank(value)) {
            return null;
        }
        return value.trim();
    }
}

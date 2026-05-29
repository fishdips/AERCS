package com.aercs.service;

import com.aercs.dto.request.ActivityRequest;
import com.aercs.dto.response.ActivityResponse;
import com.aercs.entity.Activity;
import com.aercs.entity.ActivityType;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActivityService {

    private final ActivityRepository activityRepository;
    private final EvidenceRepository evidenceRepository;
    private final UserRepository userRepository;

    @Transactional
    public ActivityResponse createActivity(ActivityRequest request, String userId) {
        validateRequest(request);

        User creator = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (creator.getDepartment() == null) {
            throw new BadRequestException("Your account must have an assigned department before creating activities");
        }

        Activity activity = new Activity();
        applyRequest(activity, request);
        activity.setDepartment(creator.getDepartment());
        activity.setCreatedBy(creator);

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

        return activityRepository.findByDepartment(user.getDepartment())
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ActivityResponse getActivity(UUID id, String userId) {
        Activity activity = findActivity(id);
        User user = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!canViewAll(user.getRole())) {
            if (user.getDepartment() == null || user.getDepartment() != activity.getDepartment()) {
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
        validateRequest(request);

        Activity activity = findActivity(id);
        var existingDepartment = activity.getDepartment();
        applyRequest(activity, request);
        activity.setDepartment(existingDepartment);
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

    private void validateRequest(ActivityRequest request) {
        if (request.office() == null) {
            throw new BadRequestException("Office is required");
        }
        if (request.activityType() == ActivityType.OTHER && trimToNull(request.customActivityType()) == null) {
            throw new BadRequestException("Custom activity type is required when Other is selected");
        }
    }

    private void applyRequest(Activity activity, ActivityRequest request) {
        activity.setActivityName(request.activityName().trim());
        activity.setDescription(trimToNull(request.description()));
        activity.setActivityType(request.activityType());
        activity.setCustomActivityType(
                request.activityType() == ActivityType.OTHER ? trimToNull(request.customActivityType()) : null
        );
        activity.setActivityDate(request.activityDate());
        activity.setOffice(request.office());
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
                activity.getCustomActivityType(),
                activity.getActivityDate(),
                activity.getDepartment() != null ? activity.getDepartment().name() : null,
                activity.getOffice() != null ? activity.getOffice().name() : null,
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

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}

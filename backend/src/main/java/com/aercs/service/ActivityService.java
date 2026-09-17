package com.aercs.service;

import com.aercs.dto.request.ActivityRequest;
import com.aercs.dto.response.ActivityResponse;
import com.aercs.entity.Activity;
import com.aercs.entity.ActivityType;
import com.aercs.entity.Department;
import com.aercs.entity.Office;
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

        User creator = userRepository.findByIdentifier(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Department creatorDepartment = creator.resolveDepartment();
        if (creatorDepartment == null && (creator.getOffice() == null || creator.getOffice().isBlank())) {
            throw new BadRequestException("Your account must have an assigned department or office before creating activities");
        }

        Activity activity = new Activity();
        applyRequest(activity, request);
        activity.setDepartment(creatorDepartment);
        if (activity.getOffice() == null || activity.getOffice().isBlank()) {
            activity.setOffice(creator.getOffice());
        }
        activity.setCreatedBy(creator);

        return toResponse(activityRepository.save(activity));
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> listActivities(String userId) {
        User user = userRepository.findByIdentifier(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (canViewAll(user.getRole())) {
            return activityRepository.findAll().stream().map(this::toResponse).toList();
        }

        return activityRepository.findAll().stream()
                .filter(activity -> isVisibleToUser(activity, user))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ActivityResponse getActivity(UUID id, String userId) {
        Activity activity = findActivity(id);
        User user = userRepository.findByIdentifier(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!canViewAll(user.getRole()) && !isVisibleToUser(activity, user)) {
            throw new ResourceNotFoundException("Activity not found");
        }

        return toResponse(activity);
    }

    private boolean isVisibleToUser(Activity activity, User user) {
        if (activity == null || user == null) {
            return false;
        }
        if (canViewAll(user.getRole())) {
            return true;
        }
        if (isServiceOfficeActivity(activity)) {
            return true;
        }
        Department userDept = user.resolveDepartment();
        if (userDept != null && userDept == activity.getDepartment()) {
            return true;
        }
        String userOffice = user.getOffice();
        if (userOffice != null && userOffice.equalsIgnoreCase(activity.getOffice())) {
            return true;
        }
        return false;
    }

    private boolean isServiceOfficeActivity(Activity activity) {
        if (activity == null) return false;
        try {
            User creator = activity.getCreatedBy();
            if (creator != null && creator.isServiceOfficeUser()) {
                return true;
            }
        } catch (Exception ignored) {
        }
        if (activity.getOffice() != null) {
            try {
                Office officeEnum = Office.valueOf(activity.getOffice());
                if (officeEnum != null && officeEnum.isServiceOffice()) {
                    return true;
                }
            } catch (IllegalArgumentException ignored) {
            }
        }
        return false;
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
        activity.setOffice(trimToNull(request.office()));
        activity.setAccreditationArea(request.accreditationArea());
        activity.setAcademicYear(request.academicYear().trim());
    }

    private ActivityResponse toResponse(Activity activity) {
        User createdBy = null;
        try {
            createdBy = activity.getCreatedBy();
        } catch (Exception ignored) {
        }
        UUID createdById = null;
        String createdByName = null;
        String createdByRole = null;
        String createdByOffice = null;
        if (createdBy != null) {
            try {
                createdById = createdBy.getId();
                createdByName = createdBy.getName();
                createdByRole = createdBy.getRole() != null ? createdBy.getRole().name() : null;
                createdByOffice = createdBy.getOffice();
            } catch (Exception ignored) {
            }
        }
        return new ActivityResponse(
                activity.getId(),
                activity.getActivityName(),
                activity.getDescription(),
                activity.getActivityType(),
                activity.getCustomActivityType(),
                activity.getActivityDate(),
                activity.getDepartment() != null ? activity.getDepartment().name() : null,
                activity.getOffice(),
                activity.getAccreditationArea(),
                activity.getAcademicYear(),
                createdById,
                createdByName,
                createdByRole,
                createdByOffice,
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

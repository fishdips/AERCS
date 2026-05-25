package com.aercs.controller;

import com.aercs.dto.request.ActivityRequest;
import com.aercs.dto.response.ActivityResponse;
import com.aercs.service.ActivityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/activities")
@RequiredArgsConstructor
public class ActivityController {

    private final ActivityService activityService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPT_STAFF', 'ACCRED_COORDINATOR', 'INSTITUTIONAL_OFFICE')")
    public ResponseEntity<ActivityResponse> createActivity(@Valid @RequestBody ActivityRequest request,
                                                            @AuthenticationPrincipal UserDetails userDetails) {
        ActivityResponse response = activityService.createActivity(request, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<ActivityResponse>> listActivities() {
        return ResponseEntity.ok(activityService.listActivities());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ActivityResponse> getActivity(@PathVariable UUID id) {
        return ResponseEntity.ok(activityService.getActivity(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPT_STAFF', 'ACCRED_COORDINATOR', 'INSTITUTIONAL_OFFICE')")
    public ResponseEntity<ActivityResponse> updateActivity(@PathVariable UUID id,
                                                            @Valid @RequestBody ActivityRequest request) {
        return ResponseEntity.ok(activityService.updateActivity(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPT_STAFF', 'ACCRED_COORDINATOR', 'INSTITUTIONAL_OFFICE')")
    public ResponseEntity<Void> deleteActivity(@PathVariable UUID id) {
        activityService.deleteActivity(id);
        return ResponseEntity.noContent().build();
    }
}

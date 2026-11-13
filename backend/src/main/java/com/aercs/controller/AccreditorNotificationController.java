package com.aercs.controller;

import com.aercs.dto.response.AccreditorNotificationListResponse;
import com.aercs.entity.User;
import com.aercs.exception.ForbiddenException;
import com.aercs.repository.UserRepository;
import com.aercs.service.AccreditorNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

// An accreditor's own notifications: links shared with them and links about to expire.
@RestController
@RequestMapping("/api/accreditor/notifications")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ACCREDITOR_LINK')")
public class AccreditorNotificationController {

    private final AccreditorNotificationService notificationService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<AccreditorNotificationListResponse> list(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(notificationService.list(resolveUserId(userDetails)));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID id, @AuthenticationPrincipal UserDetails userDetails) {
        notificationService.markRead(id, resolveUserId(userDetails));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal UserDetails userDetails) {
        notificationService.markAllRead(resolveUserId(userDetails));
        return ResponseEntity.noContent().build();
    }

    private UUID resolveUserId(UserDetails userDetails) {
        if (userDetails == null || userDetails.getUsername() == null) {
            throw new ForbiddenException("User not found");
        }
        return userRepository.findByIdentifier(userDetails.getUsername())
                .map(User::getId)
                .orElseThrow(() -> new ForbiddenException("User not found"));
    }
}

package com.aercs.controller;

import com.aercs.dto.request.AssignAccreditorsRequest;
import com.aercs.dto.request.GenerateAccreditorAccessRequest;
import com.aercs.dto.request.UpdateAccreditorAccessRequest;
import com.aercs.dto.response.AccreditorAccessLinkResponse;
import com.aercs.dto.response.AccreditorSummaryResponse;
import com.aercs.dto.response.GenerateAccreditorAccessResponse;
import com.aercs.entity.User;
import com.aercs.repository.UserRepository;
import com.aercs.service.AccreditorAccessService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// Staff side of accreditor access: create links and assign them to accreditor accounts.
// Accreditors open their links through AccreditorLinkController after logging in.
@RestController
@RequestMapping("/api/accreditor-access")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'DEPT_STAFF', 'ACCRED_COORDINATOR', 'INSTITUTIONAL_OFFICE')")
public class AccreditorAccessController {

    private final AccreditorAccessService accreditorAccessService;
    private final UserRepository userRepository;

    @PostMapping("/generate")
    public ResponseEntity<GenerateAccreditorAccessResponse> generateAccess(
            @Valid @RequestBody GenerateAccreditorAccessRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest servletRequest
    ) {
        return ResponseEntity.ok(accreditorAccessService.generateAccess(
                request, resolveUserId(userDetails), servletRequest.getHeader("Origin")));
    }

    @GetMapping
    public ResponseEntity<List<AccreditorAccessLinkResponse>> listLinks(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(accreditorAccessService.listManageableLinks(resolveUserId(userDetails)));
    }

    @GetMapping("/accreditors")
    public ResponseEntity<List<AccreditorSummaryResponse>> listAccreditors() {
        return ResponseEntity.ok(accreditorAccessService.listAccreditors());
    }

    @PatchMapping("/{id}")
    public ResponseEntity<GenerateAccreditorAccessResponse> updateAccess(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAccreditorAccessRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest servletRequest
    ) {
        return ResponseEntity.ok(accreditorAccessService.updateAccess(
                id, request, resolveUserId(userDetails), servletRequest.getHeader("Origin")));
    }

    @PostMapping("/assign")
    public ResponseEntity<Map<String, List<String>>> assignAccreditors(
            @Valid @RequestBody AssignAccreditorsRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest servletRequest
    ) {
        List<String> emailFailures = accreditorAccessService.assignAccreditors(
                request, resolveUserId(userDetails), servletRequest.getHeader("Origin"));
        return ResponseEntity.ok(Map.of("emailFailures", emailFailures));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAccess(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        accreditorAccessService.deleteAccess(id, resolveUserId(userDetails));
        return ResponseEntity.noContent().build();
    }

    private UUID resolveUserId(UserDetails userDetails) {
        if (userDetails == null || userDetails.getUsername() == null) return null;
        return userRepository.findByIdentifier(userDetails.getUsername())
                .map(User::getId)
                .orElse(null);
    }
}

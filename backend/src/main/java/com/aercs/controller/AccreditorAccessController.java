package com.aercs.controller;

import com.aercs.dto.request.GenerateAccreditorAccessRequest;
import com.aercs.dto.request.UpdateAccreditorAccessRequest;
import com.aercs.dto.request.VerifyAccreditorOtpRequest;
import com.aercs.dto.response.GenerateAccreditorAccessResponse;
import com.aercs.dto.response.PublicAccreditorAccessResponse;
import com.aercs.service.AccreditorAccessService;
import com.aercs.service.EvidenceService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ResponseCookie;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.time.Duration;

import com.aercs.entity.User;
import com.aercs.repository.UserRepository;

@RestController
@RequiredArgsConstructor
public class AccreditorAccessController {

    private static final String WRITE_ROLES = "hasAnyRole('ADMIN', 'DEPT_STAFF', 'ACCRED_COORDINATOR', 'INSTITUTIONAL_OFFICE')";

    private final AccreditorAccessService accreditorAccessService;
    private final UserRepository userRepository;
    private static final String ACCESS_SESSION_COOKIE_PREFIX = "aercs_accreditor_session_";

    @PostMapping("/api/accreditor-access/generate")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<GenerateAccreditorAccessResponse> generateAccess(
            @Valid @RequestBody GenerateAccreditorAccessRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest servletRequest
    ) {
        UUID currentUserId = resolveUserId(userDetails);
        String frontendOrigin = servletRequest.getHeader("Origin");
        return ResponseEntity.ok(accreditorAccessService.generateAccess(request, currentUserId, frontendOrigin));
    }

    @PatchMapping("/api/accreditor-access/{id}")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<GenerateAccreditorAccessResponse> extendAccess(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAccreditorAccessRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest servletRequest
    ) {
        UUID currentUserId = resolveUserId(userDetails);
        String frontendOrigin = servletRequest.getHeader("Origin");
        return ResponseEntity.ok(accreditorAccessService.extendExpiry(id, request, currentUserId, frontendOrigin));
    }

    @DeleteMapping("/api/accreditor-access/{id}")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<Void> deleteAccess(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        UUID currentUserId = resolveUserId(userDetails);
        accreditorAccessService.deleteAccess(id, currentUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/public/accreditor-access/{token}")
    public ResponseEntity<PublicAccreditorAccessResponse> getAccess(@PathVariable String token,
                                                                     HttpServletRequest request) {
        accreditorAccessService.requireVerified(token, getSessionCookie(request, token));
        return ResponseEntity.ok(accreditorAccessService.getPublicAccess(token));
    }

    @PostMapping("/api/public/accreditor-access/{token}/otp")
    public ResponseEntity<Void> requestOtp(@PathVariable String token) {
        accreditorAccessService.requestOtp(token);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/public/accreditor-access/{token}/otp/verify")
    public ResponseEntity<PublicAccreditorAccessResponse> verifyOtp(
            @PathVariable String token,
            @Valid @RequestBody VerifyAccreditorOtpRequest request,
            HttpServletResponse response
    ) {
        String sessionToken = accreditorAccessService.verifyOtp(token, request.code());
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(
                        ACCESS_SESSION_COOKIE_PREFIX + token, sessionToken)
                .httpOnly(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofHours(8))
                .build()
                .toString());
        return ResponseEntity.ok(accreditorAccessService.getPublicAccess(token));
    }

    @GetMapping("/api/public/accreditor-access/{token}/evidence/{evidenceId}/view")
    public ResponseEntity<Resource> viewEvidence(@PathVariable String token, @PathVariable UUID evidenceId,
                                                  HttpServletRequest request) {
        accreditorAccessService.requireVerified(token, getSessionCookie(request, token));
        EvidenceService.EvidenceDownload view = accreditorAccessService.getPublicView(token, evidenceId);
        return ResponseEntity.ok()
                .contentType(view.mediaType())
                .contentLength(view.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(view.originalFileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(view.resource());
    }

    @GetMapping("/api/public/accreditor-access/{token}/evidence/{evidenceId}/download")
    public ResponseEntity<Resource> downloadEvidence(@PathVariable String token, @PathVariable UUID evidenceId,
                                                      HttpServletRequest request) {
        accreditorAccessService.requireVerified(token, getSessionCookie(request, token));
        EvidenceService.EvidenceDownload download = accreditorAccessService.getPublicDownload(token, evidenceId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(download.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.originalFileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(download.resource());
    }

    private String getSessionCookie(HttpServletRequest request, String token) {
        if (request.getCookies() == null) return null;
        String cookieName = ACCESS_SESSION_COOKIE_PREFIX + token;
        for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
            if (cookieName.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    private UUID resolveUserId(UserDetails userDetails) {
        if (userDetails == null || userDetails.getUsername() == null) return null;
        return userRepository.findByIdentifier(userDetails.getUsername())
                .map(User::getId)
                .orElse(null);
    }
}

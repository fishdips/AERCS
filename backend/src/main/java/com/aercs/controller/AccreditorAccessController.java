package com.aercs.controller;

import com.aercs.dto.request.GenerateAccreditorAccessRequest;
import com.aercs.dto.response.GenerateAccreditorAccessResponse;
import com.aercs.dto.response.PublicAccreditorAccessResponse;
import com.aercs.service.AccreditorAccessService;
import com.aercs.service.EvidenceService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AccreditorAccessController {

    private static final String WRITE_ROLES = "hasAnyRole('ADMIN', 'DEPT_STAFF', 'ACCRED_COORDINATOR', 'INSTITUTIONAL_OFFICE')";

    private final AccreditorAccessService accreditorAccessService;

    @PostMapping("/api/accreditor-access/generate")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<GenerateAccreditorAccessResponse> generateAccess(
            @Valid @RequestBody GenerateAccreditorAccessRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest servletRequest
    ) {
        UUID currentUserId = UUID.fromString(userDetails.getUsername());
        String frontendOrigin = servletRequest.getHeader("Origin");
        return ResponseEntity.ok(accreditorAccessService.generateAccess(request, currentUserId, frontendOrigin));
    }

    @GetMapping("/api/public/accreditor-access/{token}")
    public ResponseEntity<PublicAccreditorAccessResponse> getAccess(@PathVariable String token) {
        return ResponseEntity.ok(accreditorAccessService.getPublicAccess(token));
    }

    @GetMapping("/api/public/accreditor-access/{token}/evidence/{evidenceId}/view")
    public ResponseEntity<Resource> viewEvidence(@PathVariable String token, @PathVariable UUID evidenceId) {
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
    public ResponseEntity<Resource> downloadEvidence(@PathVariable String token, @PathVariable UUID evidenceId) {
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
}

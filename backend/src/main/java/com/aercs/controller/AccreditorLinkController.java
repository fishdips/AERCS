package com.aercs.controller;

import com.aercs.dto.response.AccreditorLinkDetailResponse;
import com.aercs.dto.response.AccreditorLinkResponse;
import com.aercs.entity.User;
import com.aercs.exception.ForbiddenException;
import com.aercs.repository.UserRepository;
import com.aercs.service.AccreditorAccessService;
import com.aercs.service.EvidenceService;
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
import java.util.List;
import java.util.UUID;

// Accreditor side: a logged-in accreditor account sees only the links assigned to it.
@RestController
@RequestMapping("/api/accreditor/links")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ACCREDITOR_LINK')")
public class AccreditorLinkController {

    private final AccreditorAccessService accreditorAccessService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<AccreditorLinkResponse>> listLinks(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(accreditorAccessService.listLinksForAccreditor(resolveUserId(userDetails)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AccreditorLinkDetailResponse> getLink(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(accreditorAccessService.getLinkForAccreditor(id, resolveUserId(userDetails)));
    }

    @GetMapping("/{id}/evidence/{evidenceId}/view")
    public ResponseEntity<Resource> viewEvidence(
            @PathVariable UUID id,
            @PathVariable UUID evidenceId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        EvidenceService.EvidenceDownload view =
                accreditorAccessService.getEvidenceView(id, evidenceId, resolveUserId(userDetails));
        return ResponseEntity.ok()
                .contentType(view.mediaType())
                .contentLength(view.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(view.originalFileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(view.resource());
    }

    @GetMapping("/{id}/evidence/{evidenceId}/download")
    public ResponseEntity<Resource> downloadEvidence(
            @PathVariable UUID id,
            @PathVariable UUID evidenceId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        EvidenceService.EvidenceDownload download =
                accreditorAccessService.getEvidenceDownload(id, evidenceId, resolveUserId(userDetails));
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(download.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.originalFileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(download.resource());
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

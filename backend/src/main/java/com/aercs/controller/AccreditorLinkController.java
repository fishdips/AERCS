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
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.UUID;

// Accreditor side: a logged-in accreditor account sees only the links assigned to it.
@RestController
@RequestMapping("/api/accreditor/links")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ACCREDITOR_LINK')")
public class AccreditorLinkController {

    private static final Set<String> NAVIGATION_DESTINATIONS =
            Set.of("document", "iframe", "frame", "embed", "object");

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
            @RequestHeader(value = "Sec-Fetch-Dest", required = false) String fetchDest,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        // Accreditors are view-only. The app's viewer fetches this with XHR (Sec-Fetch-Dest: empty);
        // refuse the address bar / iframe / embed, where the browser's own PDF viewer would offer Save.
        if (fetchDest != null && NAVIGATION_DESTINATIONS.contains(fetchDest.toLowerCase())) {
            throw new ForbiddenException("Evidence can only be viewed inside the application");
        }
        EvidenceService.EvidenceDownload view =
                accreditorAccessService.getEvidenceView(id, evidenceId, resolveUserId(userDetails));
        return ResponseEntity.ok()
                .contentType(view.mediaType())
                .contentLength(view.fileSize())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(view.originalFileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(view.resource());
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

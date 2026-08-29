package com.aercs.controller;

import com.aercs.dto.request.BatchEvidenceMetadataRequest;
import com.aercs.dto.request.CreateLinkEvidenceRequest;
import com.aercs.dto.request.EvidenceMetadataRequest;
import com.aercs.dto.request.UpdateLinkEvidenceRequest;
import com.aercs.dto.response.EvidenceMetadataResponse;
import com.aercs.dto.response.EvidenceResponse;
import jakarta.validation.Valid;
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
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class EvidenceController {

    private static final String WRITE_ROLES = "hasAnyRole('ADMIN', 'DEPT_STAFF', 'ACCRED_COORDINATOR', 'INSTITUTIONAL_OFFICE')";

    private final EvidenceService evidenceService;

    @PostMapping(value = "/api/activities/{activityId}/evidence/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<List<EvidenceResponse>> uploadEvidence(@PathVariable UUID activityId,
                                                                  @RequestParam("files") List<MultipartFile> files,
                                                                  @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(evidenceService.uploadEvidence(activityId, files, userDetails.getUsername()));
    }

    @PostMapping("/api/activities/{activityId}/evidence/link")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<EvidenceResponse> createLinkEvidence(@PathVariable UUID activityId,
                                                                @Valid @RequestBody CreateLinkEvidenceRequest request,
                                                                @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(evidenceService.createLinkEvidence(activityId, request, userDetails.getUsername()));
    }

    @PutMapping("/api/evidence/{evidenceId}/link")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<EvidenceResponse> updateLinkEvidence(@PathVariable UUID evidenceId,
                                                                @Valid @RequestBody UpdateLinkEvidenceRequest request,
                                                                @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(evidenceService.updateLinkEvidence(evidenceId, request, userDetails.getUsername()));
    }

    @GetMapping("/api/activities/{activityId}/evidence")
    public ResponseEntity<List<EvidenceResponse>> listEvidence(@PathVariable UUID activityId) {
        return ResponseEntity.ok(evidenceService.listEvidence(activityId));
    }

    @GetMapping("/api/evidence/{evidenceId}")
    public ResponseEntity<EvidenceResponse> getEvidence(@PathVariable UUID evidenceId) {
        return ResponseEntity.ok(evidenceService.getEvidence(evidenceId));
    }

    @GetMapping("/api/evidence/{evidenceId}/metadata")
    public ResponseEntity<EvidenceMetadataResponse> getEvidenceMetadata(@PathVariable UUID evidenceId) {
        return ResponseEntity.ok(evidenceService.getMetadata(evidenceId));
    }

    @PutMapping("/api/evidence/{evidenceId}/metadata")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<EvidenceMetadataResponse> updateEvidenceMetadata(@PathVariable UUID evidenceId,
                                                                            @Valid @RequestBody EvidenceMetadataRequest request,
                                                                            @AuthenticationPrincipal UserDetails userDetails) {
        UUID currentUserId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(evidenceService.updateMetadata(evidenceId, request, currentUserId));
    }

    @PutMapping("/api/evidence/metadata/batch")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<List<EvidenceMetadataResponse>> updateEvidenceMetadataBatch(
            @Valid @RequestBody BatchEvidenceMetadataRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID currentUserId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(evidenceService.updateMetadataBatch(request, currentUserId));
    }

    @GetMapping("/api/evidence/{evidenceId}/download")
    public ResponseEntity<Resource> downloadEvidence(@PathVariable UUID evidenceId) {
        EvidenceService.EvidenceDownload download = evidenceService.getDownload(evidenceId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(download.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.originalFileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(download.resource());
    }

    @GetMapping("/api/evidence/{evidenceId}/view")
    public ResponseEntity<Resource> viewEvidence(@PathVariable UUID evidenceId) {
        EvidenceService.EvidenceDownload view = evidenceService.getView(evidenceId);
        return ResponseEntity.ok()
                .contentType(view.mediaType())
                .contentLength(view.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(view.originalFileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(view.resource());
    }

    @PutMapping(value = "/api/evidence/{evidenceId}/replace", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<EvidenceResponse> replaceEvidence(@PathVariable UUID evidenceId,
                                                             @RequestParam("file") MultipartFile file,
                                                             @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(evidenceService.replaceEvidence(evidenceId, file, userDetails.getUsername()));
    }

    @DeleteMapping("/api/evidence/{evidenceId}")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<Map<String, String>> deleteEvidence(@PathVariable UUID evidenceId,
                                                               @AuthenticationPrincipal UserDetails userDetails) {
        UUID currentUserId = UUID.fromString(userDetails.getUsername());
        evidenceService.deleteEvidence(evidenceId, currentUserId);
        return ResponseEntity.ok(Map.of("message", "Evidence removed"));
    }
}

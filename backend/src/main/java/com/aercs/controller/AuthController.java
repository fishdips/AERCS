package com.aercs.controller;

import com.aercs.dto.request.ChangePasswordRequest;
import com.aercs.dto.request.LoginRequest;
import com.aercs.dto.response.AuthMeResponse;
import com.aercs.security.JwtUtil;
import com.aercs.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<AuthMeResponse> login(@Valid @RequestBody LoginRequest request,
                                                 HttpServletResponse response) {
        String token = authService.login(request.email(), request.password());
        String userId = jwtUtil.extractUserId(token);
        AuthMeResponse me = authService.getMe(userId);
        addJwtCookie(response, token);
        return ResponseEntity.ok(me);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        clearJwtCookie(response);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<AuthMeResponse> me(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(authService.getMe(userDetails.getUsername()));
    }

    @PatchMapping("/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                                @AuthenticationPrincipal UserDetails userDetails,
                                                HttpServletResponse response) {
        String newToken = authService.changePassword(
                userDetails.getUsername(),
                request.currentPassword(),
                request.newPassword()
        );
        addJwtCookie(response, newToken);
        return ResponseEntity.noContent().build();
    }

    private void addJwtCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from("aercs_token", token)
                .httpOnly(true)
                .secure(false)      // TODO: set to true when deployed over HTTPS
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ofHours(8))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearJwtCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("aercs_token", "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}

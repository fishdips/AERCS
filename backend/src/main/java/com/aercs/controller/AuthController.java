package com.aercs.controller;

import com.aercs.dto.request.ChangePasswordRequest;
import com.aercs.dto.request.ForgotPasswordRequest;
import com.aercs.dto.request.LoginRequest;
import com.aercs.dto.request.ResetPasswordRequest;
import com.aercs.dto.response.AuthMeResponse;
import com.aercs.security.JwtUtil;
import com.aercs.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
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

    // Defaults assume a cross-origin HTTPS deployment (frontend and API on different
    // hosts/subdomains), which requires Secure + SameSite=None together or browsers
    // drop the cookie. Override with COOKIE_SECURE=false / COOKIE_SAME_SITE=Strict|Lax
    // if frontend and backend end up sharing a site, or COOKIE_SECURE=false for plain
    // HTTP local/LAN testing (see application-local.properties).
    @Value("${app.cookie.secure:true}")
    private boolean cookieSecure;

    @Value("${app.cookie.same-site:None}")
    private String cookieSameSite;

    @PostMapping("/login")
    public ResponseEntity<AuthMeResponse> login(@Valid @RequestBody LoginRequest request,
                                                 HttpServletResponse response) {
        String token = authService.login(request.email(), request.password());
        String userId = jwtUtil.extractUserId(token);
        AuthMeResponse me = authService.getMe(userId);
        addJwtCookie(response, token);
        return ResponseEntity.ok(me);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request,
                                                HttpServletRequest servletRequest) {
        authService.forgotPassword(request.email(), servletRequest.getHeader("Origin"));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.noContent().build();
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
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(Duration.ofHours(8))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearJwtCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("aercs_token", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}

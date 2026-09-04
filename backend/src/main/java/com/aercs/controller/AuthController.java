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

    // Flip to true (via COOKIE_SECURE=true) only once the app is actually served
    // over HTTPS — a Secure cookie is silently dropped by browsers over plain
    // HTTP, which would break login on any non-HTTPS deployment or LAN testing.
    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    // "Strict" works when the frontend and backend share a site (same domain,
    // or same registrable domain on different subdomains you control). It does
    // NOT work when they're on different platform-issued subdomains (e.g. two
    // separate *.onrender.com services) - browsers treat those as different
    // sites, so the cookie silently never comes back on the frontend's requests.
    // Set COOKIE_SAME_SITE=None (requires COOKIE_SECURE=true) in that case.
    @Value("${app.cookie.same-site:Strict}")
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

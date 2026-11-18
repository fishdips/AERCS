package com.aercs.service;

import com.aercs.entity.User;
import com.aercs.exception.InvitationEmailException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Sends via the Brevo HTTP API (port 443) instead of raw SMTP - Render's outbound
// network does not allow SMTP traffic (confirmed: both Office365 and Gmail SMTP time
// out from the deployed backend), so JavaMailSender never worked in production.
// The sender address is a single verified sender in Brevo (not a verified domain).
//
// Every message goes out as HTML (see EmailTemplate) with a plain-text copy as the fallback.
@Service
@RequiredArgsConstructor
@Slf4j
public class InvitationEmailService {

    private final RestClient.Builder restClientBuilder;

    @Value("${app.mail.from}")
    private String fromAddress;

    @Value("${app.brevo.api-key}")
    private String brevoApiKey;

    // Public address of the web app. Used for the logo and the "Sign in" button.
    @Value("${app.frontend-url:}")
    private String frontendUrl;

    @Value("${app.cors.allowed-origins:}")
    private String allowedOrigins;

    public void sendInvitation(User user, String temporaryPassword) {
        String text = """
                Hello %s,

                An AERCS account has been created for you.

                Email: %s
                Temporary password: %s

                Sign in with this temporary password and change it immediately when prompted.
                If you were not expecting this account, please contact your AERCS administrator.
                """.formatted(user.getName(), user.getEmail(), temporaryPassword);

        String html = EmailTemplate.render(logoUrl(),
                "Your AERCS account is ready. Sign in with the temporary password below.",
                "Your AERCS account is ready",
                List.of("Hello " + user.getName() + ", an AERCS account has been created for you."),
                List.of(EmailTemplate.Detail.of("Email", user.getEmail()),
                        EmailTemplate.Detail.emphasized("Temporary password", temporaryPassword)),
                null, null,
                "Sign in", signInUrl(),
                "Sign in with this temporary password and change it when prompted. "
                        + "If you were not expecting this account, please contact your AERCS administrator.");

        send(user.getEmail(), "Your AERCS account has been created", text, html,
                "The account invitation email could not be sent. Check the mail configuration and try again.");
    }

    public void sendAdminPasswordReset(User user, String temporaryPassword) {
        String text = """
                Hello %s,

                An administrator has reset your AERCS password.

                Email: %s
                Temporary password: %s

                Sign in with this temporary password and change it immediately when prompted.
                If you were not expecting this, please contact your AERCS administrator.
                """.formatted(user.getName(), user.getEmail(), temporaryPassword);

        String html = EmailTemplate.render(logoUrl(),
                "An administrator reset your AERCS password. Use the temporary password to sign in.",
                "Your password has been reset",
                List.of("Hello " + user.getName() + ", an administrator has reset your AERCS password."),
                List.of(EmailTemplate.Detail.of("Email", user.getEmail()),
                        EmailTemplate.Detail.emphasized("Temporary password", temporaryPassword)),
                null, null,
                "Sign in", signInUrl(),
                "Sign in with this temporary password and change it when prompted. "
                        + "If you were not expecting this, please contact your AERCS administrator.");

        send(user.getEmail(), "Your AERCS password has been reset", text, html,
                "The password reset email could not be sent. Check the mail configuration and try again.");
    }

    public void sendPasswordReset(User user, String resetUrl) {
        String text = """
                Hello %s,

                We received a request to reset your AERCS password. Click the link below to choose a new one:

                %s

                This link expires in 1 hour. If you didn't request this, you can safely ignore this email —
                your password will not be changed.
                """.formatted(user.getName(), resetUrl);

        String html = EmailTemplate.render(logoUrl(),
                "Choose a new AERCS password. This link expires in 1 hour.",
                "Reset your password",
                List.of("Hello " + user.getName() + ", we received a request to reset your AERCS password. "
                        + "Use the button below to choose a new one."),
                null, null, null,
                "Choose a new password", resetUrl,
                "This link expires in 1 hour. If you didn't request this, you can safely ignore this email. "
                        + "Your password will not be changed.");

        send(user.getEmail(), "Reset your AERCS password", text, html,
                "The password reset email could not be sent. Check the mail configuration and try again.");
    }

    // Tells a registered accreditor that one or more access links were assigned to them.
    // Links are only viewable after logging in, so the email carries no access token.
    public void sendAccreditorLinksAssigned(User accreditor, List<String> linkNames, String loginUrl) {
        String links = linkNames.stream().map(name -> "  - " + name).collect(Collectors.joining("\n"));
        String text = """
                Hello %s,

                The following AERCS accreditor access link(s) have been assigned to you:

                %s

                Log in to AERCS to review the shared evidence:
                %s

                Open "Evidence Links" after signing in to see every link assigned to your account.
                """.formatted(accreditor.getName(), links, loginUrl);

        String html = EmailTemplate.render(logoUrl(),
                "New evidence has been shared with you for review.",
                "Evidence shared with you",
                List.of("Hello " + accreditor.getName() + ", AERCS evidence has been shared with you for review."),
                null,
                linkNames.size() == 1 ? "This link was assigned to you:" : "These links were assigned to you:",
                linkNames,
                "Open AERCS", loginUrl,
                "After signing in, open \"Evidence Links\" to see every link assigned to your account.");

        send(accreditor.getEmail(), "New AERCS accreditor access link", text, html,
                "The accreditor notification email could not be sent. Check the mail configuration and try again.");
    }

    // Base address of the web app: FRONTEND_URL when set, otherwise the first allowed CORS origin.
    private String baseUrl() {
        String base = frontendUrl;
        if (base == null || base.isBlank()) {
            base = allowedOrigins == null ? "" : allowedOrigins.split(",")[0];
        }
        return base == null ? "" : base.trim().replaceAll("/+$", "");
    }

    private String signInUrl() {
        String base = baseUrl();
        return base.isEmpty() ? null : base + "/login";
    }

    // The logo is loaded from the web app's public folder. Mail clients cannot reach localhost,
    // so the image is left out unless a real https address is configured.
    private String logoUrl() {
        String base = baseUrl();
        return base.startsWith("https://") ? base + "/aercs_logo.png" : null;
    }

    private void send(String to, String subject, String text, String html, String failureMessage) {
        try {
            restClientBuilder.build()
                    .post()
                    .uri("https://api.brevo.com/v3/smtp/email")
                    .header("api-key", brevoApiKey)
                    .accept(MediaType.APPLICATION_JSON)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "sender", Map.of("email", fromAddress, "name", "AERCS"),
                            "to", List.of(Map.of("email", to)),
                            "subject", subject,
                            "htmlContent", html,
                            "textContent", text
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            // Brevo explains rejections (unverified sender, bad key, quota) in the response body.
            log.error("Brevo rejected email to {}: HTTP {} {}", to, e.getStatusCode().value(), e.getResponseBodyAsString(), e);
            throw new InvitationEmailException(failureMessage, e);
        } catch (RestClientException e) {
            // No HTTP response from Brevo (network, DNS, TLS or timeout): put the cause on the same line.
            log.error("Could not reach Brevo to send email to {}: {}", to, e.toString(), e);
            throw new InvitationEmailException(failureMessage, e);
        }
    }
}

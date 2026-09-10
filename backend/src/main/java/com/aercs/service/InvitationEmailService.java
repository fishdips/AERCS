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

import java.util.List;
import java.util.Map;

// Sends via the SendGrid HTTP API (port 443) instead of raw SMTP - Render's outbound
// network does not allow SMTP traffic (confirmed: both Office365 and Gmail SMTP time
// out from the deployed backend), so JavaMailSender never worked in production.
// The sender address is a Single Sender Verification in SendGrid (not a verified
// domain), which is enough to deliver to any recipient.
@Service
@RequiredArgsConstructor
@Slf4j
public class InvitationEmailService {

    private final RestClient.Builder restClientBuilder;

    @Value("${app.mail.from}")
    private String fromAddress;

    @Value("${app.sendgrid.api-key}")
    private String sendGridApiKey;

    public void sendInvitation(User user, String temporaryPassword) {
        String text = """
                Hello %s,

                An AERCS account has been created for you.

                Email: %s
                Temporary password: %s

                Sign in with this temporary password and change it immediately when prompted.
                If you were not expecting this account, please contact your AERCS administrator.
                """.formatted(user.getName(), user.getEmail(), temporaryPassword);

        send(user.getEmail(), "Your AERCS account has been created", text,
                "The account invitation email could not be sent. Check the mail configuration and try again.");
    }

    public void sendPasswordReset(User user, String resetUrl) {
        String text = """
                Hello %s,

                We received a request to reset your AERCS password. Click the link below to choose a new one:

                %s

                This link expires in 1 hour. If you didn't request this, you can safely ignore this email —
                your password will not be changed.
                """.formatted(user.getName(), resetUrl);

        send(user.getEmail(), "Reset your AERCS password", text,
                "The password reset email could not be sent. Check the mail configuration and try again.");
    }

    private void send(String to, String subject, String text, String failureMessage) {
        try {
            restClientBuilder.build()
                    .post()
                    .uri("https://api.sendgrid.com/v3/mail/send")
                    .header("Authorization", "Bearer " + sendGridApiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "personalizations", List.of(Map.of(
                                    "to", List.of(Map.of("email", to))
                            )),
                            "from", Map.of("email", fromAddress),
                            "subject", subject,
                            "content", List.of(Map.of(
                                    "type", "text/plain",
                                    "value", text
                            ))
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            log.error("Failed to send email to {}", to, e);
            throw new InvitationEmailException(failureMessage, e);
        }
    }
}

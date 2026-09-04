package com.aercs.service;

import com.aercs.entity.User;
import com.aercs.exception.InvitationEmailException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InvitationEmailService {
    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String fromAddress;

    public void sendInvitation(User user, String temporaryPassword) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(user.getEmail());
        message.setSubject("Your AERCS account has been created");
        message.setText("""
                Hello %s,

                An AERCS account has been created for you.

                Email: %s
                Temporary password: %s

                Sign in with this temporary password and change it immediately when prompted.
                If you were not expecting this account, please contact your AERCS administrator.
                """.formatted(user.getName(), user.getEmail(), temporaryPassword));

        try {
            mailSender.send(message);
        } catch (RuntimeException e) {
            throw new InvitationEmailException("The account invitation email could not be sent. Check the mail configuration and try again.", e);
        }
    }

    public void sendPasswordReset(User user, String resetUrl) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(user.getEmail());
        message.setSubject("Reset your AERCS password");
        message.setText("""
                Hello %s,

                We received a request to reset your AERCS password. Click the link below to choose a new one:

                %s

                This link expires in 1 hour. If you didn't request this, you can safely ignore this email —
                your password will not be changed.
                """.formatted(user.getName(), resetUrl));

        try {
            mailSender.send(message);
        } catch (RuntimeException e) {
            throw new InvitationEmailException("The password reset email could not be sent. Check the mail configuration and try again.", e);
        }
    }
}

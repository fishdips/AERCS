package com.aercs.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmailTemplateTest {

    private static final String LOGO = "https://aercs.example/aercs_logo.png";

    @Test
    void escapesUserSuppliedValues() {
        String html = EmailTemplate.render(LOGO, "preview", "Hi <b>there</b>",
                List.of("Hello <script>alert(1)</script> & \"friends\""),
                List.of(EmailTemplate.Detail.emphasized("Temporary password", "a<b>&c'd")),
                "Links:", List.of("<img src=x onerror=alert(1)>"),
                "Sign in", "https://aercs.example/login", "note <i>x</i>");

        assertFalse(html.contains("<script>"), "script tag must be escaped");
        assertFalse(html.contains("<img src=x"), "injected markup must be escaped");
        assertFalse(html.contains("<b>there</b>"));
        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;friends&quot;"));
        assertTrue(html.contains("a&lt;b&gt;&amp;c&#39;d"));
    }

    @Test
    void onlyHttpLinksAreAllowedInButtons() {
        assertEquals("", EmailTemplate.escAttr("javascript:alert(1)"));
        assertEquals("", EmailTemplate.escAttr(null));
        assertEquals("https://x.test/a?b=1&amp;c=2", EmailTemplate.escAttr("https://x.test/a?b=1&c=2"));

        String html = EmailTemplate.render(null, "p", "h", List.of("x"), null, null, null,
                "Go", "javascript:alert(1)", null);
        assertFalse(html.contains("javascript:"), "unsafe URL must not appear in an href");
    }

    @Test
    void omitsLogoAndButtonWhenNotConfigured() {
        String html = EmailTemplate.render(null, "p", "h", List.of("x"), null, null, null, "Go", null, null);
        assertFalse(html.contains("<img"));
        assertFalse(html.contains("<a href"));
    }

    // Writes sample emails to target/email-previews so the design can be opened in a browser.
    @Test
    void writesPreviewFiles() throws Exception {
        Path dir = Path.of("target", "email-previews");
        Files.createDirectories(dir);

        write(dir.resolve("invitation.html"), EmailTemplate.render(LOGO,
                "Your AERCS account is ready.", "Your AERCS account is ready",
                List.of("Hello Juan dela Cruz, an AERCS account has been created for you."),
                List.of(EmailTemplate.Detail.of("Email", "juan.delacruz@cit.edu"),
                        EmailTemplate.Detail.emphasized("Temporary password", "Xk7mQ2pLw9aB")),
                null, null, "Sign in", "https://aercs.example/login",
                "Sign in with this temporary password and change it when prompted. "
                        + "If you were not expecting this account, please contact your AERCS administrator."));

        write(dir.resolve("password-reset-link.html"), EmailTemplate.render(LOGO,
                "Choose a new AERCS password.", "Reset your password",
                List.of("Hello Juan dela Cruz, we received a request to reset your AERCS password. "
                        + "Use the button below to choose a new one."),
                null, null, null, "Choose a new password",
                "https://aercs.example/reset-password/3f9c1a7e5b2d4a60b8c1e2f3a4b5c6d7",
                "This link expires in 1 hour. If you didn't request this, you can safely ignore this email. "
                        + "Your password will not be changed."));

        write(dir.resolve("accreditor-links.html"), EmailTemplate.render(LOGO,
                "New evidence has been shared with you for review.", "Evidence shared with you",
                List.of("Hello Maria Santos, AERCS evidence has been shared with you for review."),
                null, "These links were assigned to you:",
                List.of("College of Engineering - Program Review 2026", "Library Accreditation Evidence"),
                "Open AERCS", "https://aercs.example/login",
                "After signing in, open \"Evidence Links\" to see every link assigned to your account."));
    }

    private static void write(Path path, String html) throws Exception {
        Files.writeString(path, html, StandardCharsets.UTF_8);
    }
}

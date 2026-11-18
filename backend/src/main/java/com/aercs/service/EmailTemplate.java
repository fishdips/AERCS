package com.aercs.service;

import java.util.List;

/**
 * Builds the HTML version of AERCS emails.
 *
 * Email clients (Outlook, Gmail, ...) ignore most modern CSS, so the layout uses nested
 * tables with inline styles, system fonts and no scripts. Every value that comes from a
 * user or the database goes through {@link #esc(String)}; templates never concatenate raw
 * input into markup.
 */
final class EmailTemplate {

    // Same palette as the web app (see web/src/styles/tokens.css).
    private static final String BG = "#ede8e1";
    private static final String SURFACE = "#fcfaf7";
    private static final String INK = "#1a1a1a";
    private static final String TEXT2 = "#45413c";
    private static final String MUTED = "#65605a";
    private static final String BRAND = "#004aad";
    private static final String RULE = "#cfc8bd";
    private static final String CALLOUT = "#e3dccf";
    private static final String FONT = "Arial, Helvetica, sans-serif";

    private EmailTemplate() {
    }

    /** One labelled value shown in the framed details box (e.g. Email, Temporary password). */
    record Detail(String label, String value, boolean emphasized) {
        static Detail of(String label, String value) {
            return new Detail(label, value, false);
        }

        static Detail emphasized(String label, String value) {
            return new Detail(label, value, true);
        }
    }

    /**
     * @param logoUrl   absolute https URL of the logo, or blank to omit the image
     * @param preheader short summary shown next to the subject in the inbox list
     * @param heading   main title inside the card
     * @param paragraphs plain-text paragraphs (escaped here)
     * @param details   optional framed key/value rows
     * @param listTitle optional text introducing {@code listItems}
     * @param listItems optional bullet items (escaped here)
     * @param buttonLabel / buttonUrl optional call-to-action button
     * @param footnote  small muted text under the card content
     */
    static String render(String logoUrl, String preheader, String heading, List<String> paragraphs,
                         List<Detail> details, String listTitle, List<String> listItems,
                         String buttonLabel, String buttonUrl, String footnote) {
        StringBuilder body = new StringBuilder();

        body.append("<h1 style=\"margin:0 0 16px;font-family:").append(FONT)
                .append(";font-size:22px;line-height:1.25;font-weight:bold;color:").append(INK).append(";\">")
                .append(esc(heading)).append("</h1>");

        for (String p : paragraphs) {
            body.append("<p style=\"margin:0 0 16px;font-family:").append(FONT)
                    .append(";font-size:15px;line-height:1.55;color:").append(TEXT2).append(";\">")
                    .append(esc(p)).append("</p>");
        }

        if (details != null && !details.isEmpty()) {
            body.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" ")
                    .append("style=\"margin:4px 0 20px;background:").append(CALLOUT).append(";border-radius:6px;\">")
                    .append("<tr><td style=\"padding:14px 18px;\">");
            for (Detail d : details) {
                body.append("<div style=\"margin:0 0 10px;\">")
                        .append("<div style=\"font-family:").append(FONT)
                        .append(";font-size:12px;line-height:1.4;color:").append(MUTED).append(";\">")
                        .append(esc(d.label())).append("</div>");
                if (d.emphasized()) {
                    body.append("<div style=\"font-family:'Courier New',Courier,monospace;font-size:20px;")
                            .append("line-height:1.4;font-weight:bold;letter-spacing:1px;color:").append(INK)
                            .append(";\">").append(esc(d.value())).append("</div>");
                } else {
                    body.append("<div style=\"font-family:").append(FONT)
                            .append(";font-size:15px;line-height:1.4;color:").append(INK).append(";\">")
                            .append(esc(d.value())).append("</div>");
                }
                body.append("</div>");
            }
            body.append("</td></tr></table>");
        }

        if (listItems != null && !listItems.isEmpty()) {
            if (listTitle != null && !listTitle.isBlank()) {
                body.append("<p style=\"margin:0 0 8px;font-family:").append(FONT)
                        .append(";font-size:15px;line-height:1.55;color:").append(TEXT2).append(";\">")
                        .append(esc(listTitle)).append("</p>");
            }
            body.append("<ul style=\"margin:0 0 20px;padding:0 0 0 20px;font-family:").append(FONT)
                    .append(";font-size:15px;line-height:1.6;color:").append(INK).append(";\">");
            for (String item : listItems) {
                body.append("<li style=\"margin:0 0 4px;\">").append(esc(item)).append("</li>");
            }
            body.append("</ul>");
        }

        // escAttr drops anything that is not an http(s) URL, in which case no button is rendered at all.
        String safeUrl = escAttr(buttonUrl);
        if (buttonLabel != null && !safeUrl.isEmpty()) {
            // Bulletproof-ish button: a padded link. Outlook ignores the radius but still shows a blue block.
            body.append("<table role=\"presentation\" align=\"center\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:8px auto 20px;\">")
                    .append("<tr><td bgcolor=\"").append(BRAND).append("\" style=\"border-radius:6px;\">")
                    .append("<a href=\"").append(safeUrl).append("\" target=\"_blank\" ")
                    .append("style=\"display:inline-block;padding:12px 24px;font-family:").append(FONT)
                    .append(";font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;\">")
                    .append(esc(buttonLabel)).append("</a></td></tr></table>")
                    // Fallback for clients that block the button.
                    .append("<p style=\"margin:0 0 16px;text-align:center;font-family:").append(FONT)
                    .append(";font-size:12px;line-height:1.5;color:").append(MUTED).append(";\">")
                    .append("If the button doesn't work, copy this link into your browser:<br>")
                    .append("<a href=\"").append(safeUrl).append("\" style=\"color:").append(BRAND)
                    .append(";word-break:break-all;\">").append(safeUrl).append("</a></p>");
        }

        if (footnote != null && !footnote.isBlank()) {
            body.append("<p style=\"margin:8px 0 0;padding-top:16px;border-top:1px solid ").append(RULE)
                    .append(";font-family:").append(FONT).append(";font-size:13px;line-height:1.55;color:")
                    .append(MUTED).append(";\">").append(esc(footnote)).append("</p>");
        }

        StringBuilder logo = new StringBuilder();
        if (logoUrl != null && !logoUrl.isBlank()) {
            logo.append("<td style=\"padding-right:10px;\" valign=\"middle\"><img src=\"").append(escAttr(logoUrl))
                    .append("\" alt=\"\" height=\"36\" style=\"display:block;height:36px;border:0;\"></td>");
        }

        return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<meta name=\"color-scheme\" content=\"light\"><title>" + esc(heading) + "</title></head>"
                + "<body style=\"margin:0;padding:0;background:" + BG + ";\">"
                // Hidden preview text shown by inbox lists.
                + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:" + BG + ";\">"
                + esc(preheader) + "</div>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"" + BG + "\">"
                + "<tr><td align=\"center\" style=\"padding:32px 16px;\">"
                + "<table role=\"presentation\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:560px;\">"
                // Header
                + "<tr><td style=\"padding:0 4px 20px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>"
                + logo
                + "<td valign=\"middle\" style=\"font-family:" + FONT + ";font-size:20px;font-weight:bold;color:" + BRAND + ";\">AERCS</td>"
                + "</tr></table></td></tr>"
                // Card
                + "<tr><td style=\"background:" + SURFACE + ";border:1px solid " + RULE + ";border-radius:8px;padding:28px 28px 20px;\">"
                + body
                + "</td></tr>"
                // Footer
                + "<tr><td style=\"padding:16px 4px 0;font-family:" + FONT + ";font-size:12px;line-height:1.5;color:" + MUTED + ";\">"
                + "Accreditation Evidence Repository &amp; Coordination System. This is an automated message, please do not reply."
                + "</td></tr>"
                + "</table></td></tr></table></body></html>";
    }

    /** Escapes text for use inside an HTML element. */
    static String esc(String value) {
        if (value == null) return "";
        StringBuilder sb = new StringBuilder(value.length() + 16);
        for (char c : value.toCharArray()) {
            switch (c) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                case '\'' -> sb.append("&#39;");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    /** Escapes a value for an HTML attribute; only http(s) URLs are allowed (no javascript: links). */
    static String escAttr(String url) {
        if (url == null) return "";
        String trimmed = url.trim();
        String lower = trimmed.toLowerCase();
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            return "";
        }
        return esc(trimmed);
    }
}

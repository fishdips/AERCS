package com.aercs.util;

import java.net.URI;
import java.util.Locale;

/**
 * Evidence links must point at a document, not at a Google Drive folder.
 *
 * <p>Folder links are recognised by their URL shape, so nothing is fetched from Google:
 * <ul>
 *   <li>{@code /drive/folders/ID}, {@code /drive/u/0/folders/ID}, {@code /drive/mobile/folders/ID}</li>
 *   <li>{@code /folderview?id=ID} and {@code /embeddedfolderview?id=ID}</li>
 *   <li>Drive browse pages such as {@code /drive/my-drive}, {@code /drive/shared-with-me},
 *       {@code /drive/shared-drives} and the Drive home page, which are not documents either.</li>
 * </ul>
 * Links to a file ({@code /file/d/ID/view}) and to Google Docs, Sheets and Slides are fine.
 * {@code /open?id=ID} can be either a file or a folder and cannot be told apart without asking
 * Google, so it is allowed.
 */
public final class DriveLinkPolicy {

    public static final String FOLDER_LINK_MESSAGE =
            "Google Drive folder links can't be added. Share a link to a specific document or file instead.";

    private DriveLinkPolicy() {
    }

    public static boolean isGoogleDriveFolderLink(String link) {
        if (link == null || link.isBlank()) {
            return false;
        }
        URI uri;
        try {
            uri = new URI(link.trim());
        } catch (Exception e) {
            return false; // not a parseable URL; the normal URL validation reports that
        }
        String host = uri.getHost();
        if (host == null) {
            return false;
        }
        host = host.toLowerCase(Locale.ROOT);
        if (host.startsWith("www.")) {
            host = host.substring(4);
        }
        if (!host.equals("drive.google.com")) {
            return false;
        }

        String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase(Locale.ROOT);
        if (path.isEmpty() || path.equals("/")) {
            return true; // the Drive home page is not a document
        }
        if (path.contains("/folders/") || path.endsWith("/folders")) {
            return true;
        }
        if (path.equals("/folderview") || path.startsWith("/folderview/")
                || path.equals("/embeddedfolderview") || path.startsWith("/embeddedfolderview/")) {
            return true;
        }
        // Everything else under /drive/ is a browse view (my-drive, shared-with-me, recent, ...).
        return (path.equals("/drive") || path.startsWith("/drive/")) && !path.contains("/file/d/");
    }
}

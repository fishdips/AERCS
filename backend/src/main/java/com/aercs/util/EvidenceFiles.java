package com.aercs.util;

import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

/** File-name, type and hashing helpers shared by the evidence services. */
public final class EvidenceFiles {

    private EvidenceFiles() {
    }

    public static String cleanFileName(String fileName) {
        if (fileName == null || fileName.trim().isEmpty()) return "evidence-file";
        return Paths.get(fileName).getFileName().toString();
    }

    /** Lower-case extension without the dot, or "" when there is none. */
    public static String getExtension(String fileName) {
        String cleanName = cleanFileName(fileName);
        int dot = cleanName.lastIndexOf('.');
        if (dot < 0 || dot == cleanName.length() - 1) return "";
        return cleanName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public static String contentTypeFor(String extension) {
        return switch (extension.toLowerCase(Locale.ROOT)) {
            case "pdf"  -> "application/pdf";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "jpg", "jpeg" -> "image/jpeg";
            case "png"  -> "image/png";
            default     -> "application/octet-stream";
        };
    }

    /** The media type used to show a file inline, or null when it can't be previewed. */
    public static MediaType previewMediaType(String fileType) {
        return switch (fileType) {
            case "PDF"        -> MediaType.APPLICATION_PDF;
            case "PNG"        -> MediaType.IMAGE_PNG;
            case "JPG", "JPEG" -> MediaType.IMAGE_JPEG;
            case "DOCX"       -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            case "XLSX"       -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            default           -> null;
        };
    }

    /**
     * SHA-256 of the upload as lower-case hex, computed by streaming so the file is never held in
     * memory just for hashing. Throws if the upload can't be read: the hash decides whether the file
     * is a duplicate, so an upload must not continue without one.
     */
    public static String sha256(MultipartFile file) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e); // required on every JVM
        }
        try (InputStream in = file.getInputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        byte[] hash = digest.digest();
        StringBuilder hex = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            hex.append(Character.forDigit((b >> 4) & 0xF, 16));
            hex.append(Character.forDigit(b & 0xF, 16));
        }
        return hex.toString();
    }
}

package com.aercs.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class DriveLinkPolicyTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "https://drive.google.com/drive/folders/1AbCdEfGhIjK",
            "https://drive.google.com/drive/folders/1AbCdEfGhIjK?usp=sharing",
            "https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjK",
            "https://drive.google.com/drive/u/2/folders/1AbCdEfGhIjK?resourcekey=abc",
            "https://drive.google.com/drive/mobile/folders/1AbCdEfGhIjK",
            "https://drive.google.com/folderview?id=1AbCdEfGhIjK",
            "https://drive.google.com/embeddedfolderview?id=1AbCdEfGhIjK",
            "https://drive.google.com/drive/my-drive",
            "https://drive.google.com/drive/u/0/my-drive",
            "https://drive.google.com/drive/shared-with-me",
            "https://drive.google.com/drive/shared-drives",
            "https://drive.google.com/drive",
            "https://drive.google.com/",
            "https://drive.google.com",
            "  https://drive.google.com/drive/folders/1AbCdEfGhIjK  ",
            "HTTPS://DRIVE.GOOGLE.COM/DRIVE/FOLDERS/1AbCdEfGhIjK",
            "https://www.drive.google.com/drive/folders/1AbCdEfGhIjK",
            "http://drive.google.com/drive/folders/1AbCdEfGhIjK",
            "https://drive.google.com/drive/%66olders/1AbCdEfGhIjK"
    })
    void folderLinksAreRejected(String link) {
        assertThat(DriveLinkPolicy.isGoogleDriveFolderLink(link)).as(link).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "https://drive.google.com/file/d/1AbCdEfGhIjK/view",
            "https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing",
            "https://drive.google.com/file/u/0/d/1AbCdEfGhIjK/view",
            "https://drive.google.com/open?id=1AbCdEfGhIjK",
            "https://drive.google.com/uc?export=download&id=1AbCdEfGhIjK",
            "https://docs.google.com/document/d/1AbCdEfGhIjK/edit",
            "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjK/edit#gid=0",
            "https://docs.google.com/presentation/d/1AbCdEfGhIjK/edit",
            "https://docs.google.com/forms/d/e/1FAIpQLSe/viewform",
            "https://example.com/report.pdf",
            "https://example.com/drive/folders/1AbCdEfGhIjK",
            "https://notdrive.google.com.evil.example/drive/folders/1AbCdEfGhIjK"
    })
    void documentAndOtherLinksAreAllowed(String link) {
        assertThat(DriveLinkPolicy.isGoogleDriveFolderLink(link)).as(link).isFalse();
    }

    @Test
    void blankAndUnparseableInputIsLeftToTheNormalUrlValidation() {
        assertThat(DriveLinkPolicy.isGoogleDriveFolderLink(null)).isFalse();
        assertThat(DriveLinkPolicy.isGoogleDriveFolderLink("")).isFalse();
        assertThat(DriveLinkPolicy.isGoogleDriveFolderLink("   ")).isFalse();
        assertThat(DriveLinkPolicy.isGoogleDriveFolderLink("not a url at all")).isFalse();
        assertThat(DriveLinkPolicy.isGoogleDriveFolderLink("https://drive.google.com/drive/folders/a b")).isFalse();
    }
}

package com.tripmate.document;

public record DocumentDownloadUrl(
        String url,
        long expiresInSeconds
) {
}

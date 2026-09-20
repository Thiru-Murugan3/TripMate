package com.tripmate.discovery;

public record DiscoveryImage(
        String url,
        String sourcePage,
        String sourceName,
        String author,
        String license,
        String attribution,
        boolean exact,
        boolean primary
) {
}

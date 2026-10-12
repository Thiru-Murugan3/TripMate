package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ImageResolverService {
    private final CommonsImageService commons;

    public ImageResolverService(CommonsImageService commons) { this.commons = commons; }

    public ResolvedImages fromOpenStreetMap(JsonNode tags, String sourceUrl) {
        DiscoveryImage image = commons.resolve(clean(tags.path("wikimedia_commons").asText(null)));
        String raw = clean(tags.path("image").asText(null));
        if (image == null) image = commons.resolveUrl(raw);
        if (image == null && raw != null && raw.startsWith("https://")) {
            String author = clean(tags.path("image:author").asText(null));
            String license = clean(tags.path("image:license").asText(null));
            if (author != null && license != null) {
                image = new DiscoveryImage(raw, sourceUrl, "OpenStreetMap image tag", author,
                        license, author, true, true);
            }
        }
        return new ResolvedImages(image, image == null ? List.of() : List.of(image));
    }

    public String categoryPlaceholder(DiscoveryCategory category) {
        return "/place-placeholder.svg?category=" + category.name().toLowerCase();
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record ResolvedImages(DiscoveryImage primary, List<DiscoveryImage> gallery) {
    }
}

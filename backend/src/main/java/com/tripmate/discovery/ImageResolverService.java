package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Service
public class ImageResolverService {
    public ResolvedImages fromOpenStreetMap(JsonNode tags, String sourceUrl) {
        String image = clean(tags.path("image").asText(null));
        if (image != null && (image.startsWith("https://") || image.startsWith("http://"))) {
            DiscoveryImage result = new DiscoveryImage(image, sourceUrl, "OpenStreetMap image tag", null,
                    "See source page", "See linked OpenStreetMap source", true, true);
            return new ResolvedImages(result, List.of(result));
        }

        String commons = clean(tags.path("wikimedia_commons").asText(null));
        if (commons != null && commons.toLowerCase().startsWith("file:")) {
            String fileName = commons.substring(5).trim();
            String filePage = "https://commons.wikimedia.org/wiki/" + commons.replace(" ", "_");
            String url = "https://commons.wikimedia.org/wiki/Special:FilePath/"
                    + URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
            DiscoveryImage result = new DiscoveryImage(url, filePage, "Wikimedia Commons", null,
                    "See Wikimedia Commons file page", commons, true, true);
            return new ResolvedImages(result, List.of(result));
        }
        return new ResolvedImages(null, List.of());
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

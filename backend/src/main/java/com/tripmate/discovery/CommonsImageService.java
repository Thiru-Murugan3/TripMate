package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.provider.ProviderHttpClientFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/** Resolves the file's own author and licence instead of crediting an encyclopedia page. */
@Service
public class CommonsImageService {
    private final RestClient client;
    private final ExpiringCache<String, DiscoveryImage> cache = new ExpiringCache<>(1000);

    @Autowired
    public CommonsImageService(ProviderHttpClientFactory factory) { this(factory.create(5000)); }
    CommonsImageService(RestClient client) { this.client = client; }

    public DiscoveryImage resolve(String file) {
        if (file == null || !file.regionMatches(true, 0, "File:", 0, 5)) return null;
        DiscoveryImage cached = cache.get(file);
        if (cached != null) return cached;
        try {
            URI uri = UriComponentsBuilder.fromUriString("https://commons.wikimedia.org/w/api.php")
                    .queryParam("action", "query").queryParam("format", "json")
                    .queryParam("titles", file).queryParam("prop", "imageinfo")
                    .queryParam("iiprop", "url|extmetadata").queryParam("iiurlwidth", 960)
                    .build().encode().toUri();
            DiscoveryImage image = fromResponse(client.get().uri(uri).retrieve().body(JsonNode.class));
            if (image != null) cache.put(file, image, Instant.now().plus(7, ChronoUnit.DAYS));
            return image;
        } catch (RuntimeException ex) {
            return null; // Missing evidence uses the neutral placeholder.
        }
    }

    public DiscoveryImage resolveUrl(String url) {
        if (url == null) return null;
        try {
            URI uri = URI.create(url);
            if (!"upload.wikimedia.org".equalsIgnoreCase(uri.getHost())) return null;
            String path = uri.getRawPath();
            if (!path.startsWith("/wikipedia/commons/")) return null;
            String[] parts = path.split("/");
            String name = path.contains("/thumb/") ? parts[parts.length - 2] : parts[parts.length - 1];
            return resolve("File:" + URLDecoder.decode(name.replace("+", "%2B"), StandardCharsets.UTF_8));
        } catch (IllegalArgumentException ex) { return null; }
    }

    DiscoveryImage fromResponse(JsonNode response) {
        if (response == null) return null;
        for (JsonNode page : response.path("query").path("pages")) {
            JsonNode info = page.path("imageinfo").path(0);
            JsonNode metadata = info.path("extmetadata");
            String author = plain(metadata.path("Artist").path("value").asText(""));
            String license = plain(metadata.path("LicenseShortName").path("value").asText(""));
            String url = info.path("thumburl").asText(info.path("url").asText(""));
            String source = info.path("descriptionurl").asText("");
            if (author.isBlank() || license.isBlank() || !url.startsWith("https://") || !source.startsWith("https://")) continue;
            String credit = plain(metadata.path("Credit").path("value").asText(""));
            String attribution = author + (credit.isBlank() || credit.equals(author) ? "" : " · " + credit);
            return new DiscoveryImage(url, source, "Wikimedia Commons", author, license, attribution, true, true);
        }
        return null;
    }

    private String plain(String html) {
        return HtmlUtils.htmlUnescape(html.replaceAll("<[^>]*>", " ")).replaceAll("\\s+", " ").trim();
    }
}

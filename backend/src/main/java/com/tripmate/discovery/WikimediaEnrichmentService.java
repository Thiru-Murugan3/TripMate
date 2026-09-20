package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.provider.ProviderHttpClientFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class WikimediaEnrichmentService {
    private final RestClient client;
    private final String wikipediaBase;
    private final String wikidataBase;
    private final Map<String, CachedEnrichment> cache = new ConcurrentHashMap<>();

    public WikimediaEnrichmentService(
            ProviderHttpClientFactory factory,
            @Value("${discovery.wikipedia-url:https://en.wikipedia.org}") String wikipediaBase,
            @Value("${discovery.wikidata-url:https://www.wikidata.org}") String wikidataBase
    ) {
        this.client = factory.create(5000);
        this.wikipediaBase = wikipediaBase.replaceAll("/$", "");
        this.wikidataBase = wikidataBase.replaceAll("/$", "");
    }

    public Enrichment resolve(JsonNode tags) {
        String wikipedia = clean(tags.path("wikipedia").asText(null));
        String wikidata = clean(tags.path("wikidata").asText(null));
        String key = wikipedia != null ? "wikipedia:" + wikipedia : wikidata != null ? "wikidata:" + wikidata : null;
        if (key == null) return Enrichment.empty();
        CachedEnrichment cached = cache.get(key);
        if (cached != null && cached.createdAt().plus(Duration.ofDays(7)).isAfter(Instant.now())) return cached.value();
        Enrichment value = wikipedia != null ? wikipedia(wikipedia) : wikidata(wikidata);
        cache.put(key, new CachedEnrichment(Instant.now(), value));
        return value;
    }

    private Enrichment wikipedia(String tag) {
        String title = tag.contains(":") ? tag.substring(tag.indexOf(':') + 1) : tag;
        try {
            URI uri = URI.create(wikipediaBase + "/api/rest_v1/page/summary/"
                    + URLEncoder.encode(title.replace(' ', '_'), StandardCharsets.UTF_8).replace("+", "%20"));
            JsonNode response = client.get().uri(uri).retrieve().body(JsonNode.class);
            if (response == null) return Enrichment.empty();
            String imageUrl = response.path("thumbnail").path("source").asText(null);
            String pageUrl = response.path("content_urls").path("desktop").path("page").asText(null);
            DiscoveryImage image = imageUrl == null ? null : new DiscoveryImage(imageUrl, pageUrl,
                    "Wikipedia/Wikimedia Commons", null, "See source page", "Wikipedia page thumbnail", true, true);
            return new Enrichment(response.path("extract").asText(null), image, pageUrl, null);
        } catch (RestClientException | IllegalArgumentException ex) {
            return Enrichment.empty();
        }
    }

    private Enrichment wikidata(String id) {
        if (id == null || !id.matches("Q\\d+")) return Enrichment.empty();
        try {
            JsonNode entity = client.get().uri(URI.create(wikidataBase + "/wiki/Special:EntityData/" + id + ".json"))
                    .retrieve().body(JsonNode.class);
            JsonNode root = entity == null ? null : entity.path("entities").path(id);
            if (root == null || root.isMissingNode()) return Enrichment.empty();
            String description = root.path("descriptions").path("en").path("value").asText(null);
            JsonNode claims = root.path("claims").path("P18");
            String fileName = claims.isArray() && !claims.isEmpty()
                    ? claims.get(0).path("mainsnak").path("datavalue").path("value").asText(null) : null;
            DiscoveryImage image = null;
            if (fileName != null) {
                String fileUrl = "https://commons.wikimedia.org/wiki/Special:FilePath/"
                        + URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
                String sourcePage = "https://commons.wikimedia.org/wiki/File:" + fileName.replace(' ', '_');
                image = new DiscoveryImage(fileUrl, sourcePage, "Wikimedia Commons", null,
                        "See Wikimedia Commons file page", "Wikidata P18 exact-place image", true, true);
            }
            return new Enrichment(description, image, wikidataBase + "/wiki/" + id, id);
        } catch (RestClientException | IllegalArgumentException ex) {
            return Enrichment.empty();
        }
    }

    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    public record Enrichment(String description, DiscoveryImage image, String sourceUrl, String wikidataId) {
        public static Enrichment empty() { return new Enrichment(null, null, null, null); }
        public List<DiscoveryImage> gallery() { return image == null ? List.of() : List.of(image); }
    }
    private record CachedEnrichment(Instant createdAt, Enrichment value) {
    }
}

package com.tripmate.discovery.tripadvisor;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.provider.ProviderHttpClientFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.http.HttpStatus;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Live-only Content API adapter. Deliberately excluded from DiscoveryProvider caches and saved places. */
@Service
public class TripadvisorService {
    private static final String BASE = "https://api.content.tripadvisor.com/api/v1/location";
    private final RestClient client;
    private final TripadvisorBudget budget;
    private final String key;

    @org.springframework.beans.factory.annotation.Autowired
    public TripadvisorService(ProviderHttpClientFactory factory, TripadvisorBudget budget,
            @Value("${discovery.tripadvisor.api-key:}") String key) {
        this(factory.create(10000), budget, key);
    }
    TripadvisorService(RestClient client, TripadvisorBudget budget, String key) {
        this.client = client;
        this.budget = budget;
        this.key = key == null ? "" : key.trim();
    }
    public boolean available() { return !key.isBlank(); }

    public record Location(String id, String name, String address) {}
    public record Details(String id, String name, String address, String description, String webUrl,
                          String ratingImageUrl, String reviewCount) {}
    public record Photo(String url, String caption, String author, String sourceUrl) {}

    public List<Location> search(String query, String category) {
        if (query == null || query.trim().length() < 2 || query.length() > 180
                || !Set.of("attractions", "hotels", "restaurants").contains(category))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a destination and a supported category");
        JsonNode response = get("/search", "searchQuery", query.trim(), "category", category);
        List<Location> results = new ArrayList<>();
        for (JsonNode node : response.path("data")) {
            String id = text(node, "location_id");
            if (id == null || !id.matches("[0-9]{1,12}")) continue;
            results.add(new Location(id, text(node, "name"), text(node.path("address_obj"), "address_string")));
            if (results.size() == 10) break;
        }
        return results;
    }
    public Details details(String id) {
        validateId(id);
        JsonNode node = get("/" + id + "/details", "currency", "INR");
        return new Details(id, text(node, "name"), text(node.path("address_obj"), "address_string"),
                text(node, "description"), safeUrl(text(node, "web_url"), false),
                safeUrl(text(node, "rating_image_url"), true), text(node, "num_reviews"));
    }
    public List<Photo> photos(String id) {
        validateId(id);
        JsonNode response = get("/" + id + "/photos", "limit", "5");
        List<Photo> photos = new ArrayList<>();
        for (JsonNode node : response.path("data")) {
            String url = safeUrl(text(node.path("images").path("large"), "url"), true);
            String source = safeUrl(text(node, "photo_url"), false);
            String author = text(node.path("user"), "username");
            if (url == null || source == null || author == null) continue;
            photos.add(new Photo(url, text(node, "caption"), author, source));
            if (photos.size() == 5) break;
        }
        return photos;
    }
    private JsonNode get(String path, String... params) {
        if (!available()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Tripadvisor is not configured");
        budget.reserve();
        var builder = UriComponentsBuilder.fromUriString(BASE + path).queryParam("key", key).queryParam("language", "en");
        for (int i = 0; i < params.length; i += 2) builder.queryParam(params[i], params[i + 1]);
        try {
            JsonNode body = client.get().uri(builder.build().encode().toUri()).retrieve().body(JsonNode.class);
            if (body == null || body.has("error") || body.has("errors"))
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Tripadvisor returned an unavailable response");
            return body;
        } catch (RestClientResponseException ex) {
            // Never expose upstream exception text: its URL/body may contain the API key.
            if (ex.getStatusCode().value() == 429)
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Tripadvisor request allowance reached. Please try later.");
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Tripadvisor is temporarily unavailable. Please try again later.");
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to reach Tripadvisor. Please try again later.");
        }
    }
    private void validateId(String id) {
        if (id == null || !id.matches("[0-9]{1,12}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Tripadvisor location");
    }
    private String text(JsonNode node, String field) {
        String value = node.path(field).asText(null);
        return value == null || value.isBlank() ? null : value;
    }
    static String safeUrl(String value, boolean image) {
        if (value == null) return null;
        try {
            URI uri = URI.create(value);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getUserInfo() != null
                    || uri.getPort() != -1 || uri.getRawQuery() != null && uri.getRawQuery().toLowerCase().contains("key=")) return null;
            host = host.toLowerCase(java.util.Locale.ROOT);
            boolean trusted = host.equals("tripadvisor.com") || host.endsWith(".tripadvisor.com")
                    || host.equals("tripadvisor.in") || host.endsWith(".tripadvisor.in")
                    || image && (host.equals("tacdn.com") || host.endsWith(".tacdn.com"));
            return trusted ? value : null;
        } catch (IllegalArgumentException ex) { return null; }
    }
}

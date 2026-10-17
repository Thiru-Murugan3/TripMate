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
    private final String referer;
    private final boolean refererValid;
    private String apiMode = "LEGACY";
    private TerraTripadvisorClient terra;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(TripadvisorService.class);

    @org.springframework.beans.factory.annotation.Autowired
    public TripadvisorService(ProviderHttpClientFactory factory, TripadvisorBudget budget,
            @Value("${discovery.tripadvisor.api-key:}") String key,
            @Value("${discovery.tripadvisor.referer:https://www.suttru.in}") String referer,
            @Value("${discovery.tripadvisor.api-mode:LEGACY}") String apiMode,
            TerraTripadvisorClient terra) {
        this(factory.create(10000), budget, key, referer);
        this.apiMode = "TERRA".equalsIgnoreCase(apiMode) ? "TERRA" : "LEGACY".equalsIgnoreCase(apiMode) ? "LEGACY" : "UNKNOWN";
        this.terra = terra;
    }
    TripadvisorService(RestClient client, TripadvisorBudget budget, String key) {
        this(client, budget, key, "https://www.suttru.in");
    }
    TripadvisorService(RestClient client, TripadvisorBudget budget, String key, String referer) {
        this.client = client;
        this.budget = budget;
        this.key = key == null ? "" : key.trim();
        String normalized = "";
        boolean valid = true;
        try { normalized = normalizeReferer(referer); }
        catch (IllegalArgumentException ex) {
            valid = false;
            log.warn("Tripadvisor disabled: invalid referer configuration");
        }
        this.referer = normalized;
        this.refererValid = valid;
    }
    public boolean available() { return "TERRA".equals(apiMode) ? terra != null && terra.available() : "LEGACY".equals(apiMode) && !key.isBlank() && refererValid; }
    public String apiMode() { return apiMode; }
    public String setupCode() { return "TERRA".equals(apiMode) && terra != null ? terra.setupCode() : available() ? "" : "NOT_CONFIGURED"; }

    public record Location(String id, String name, String address, String webUrl) {
        public Location(String id, String name, String address) { this(id, name, address, null); }
    }
    public record Details(String id, String name, String address, String description, String webUrl,
                          String ratingImageUrl, String reviewCount) {}
    public record Photo(String url, String caption, String author, String sourceUrl) {}

    public record SearchPage(List<Location> places, int page, int size, Long totalElements, Integer totalPages, boolean hasNext) {}
    static void validatePage(int page, int size) {
        if (page < 1 || size < 1 || size > 20)
            throw new TripadvisorFailure(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Page must be positive and size between 1 and 20");
    }
    public SearchPage searchPage(String query, String category, int page, int size) {
        return searchPage(query, category, page, size, "COMBINED");
    }
    public SearchPage searchPage(String query, String category, int page, int size, String searchType) {
        return searchPage(query, category, page, size, searchType, "");
    }
    public SearchPage searchPage(String query, String category, int page, int size, String searchType, String city) {
        validatePage(page, size);
        if (city == null || city.length() > 180 || !city.isBlank() && city.trim().length() < 2)
            throw new TripadvisorFailure(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Choose a valid city");
        if (!Set.of("COMBINED", "NAME").contains(searchType == null ? "" : searchType))
            throw new TripadvisorFailure(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Unsupported search mode");
        if ("TERRA".equals(apiMode)) return terra.searchPage(query, category, page, size, searchType, city);
        if (!city.isBlank()) throw new TripadvisorFailure(HttpStatus.BAD_REQUEST, "CITY_FILTER_UNAVAILABLE", "Searching within a city requires Terra API mode");
        // Legacy search has no provider pagination. Do not pretend more matches can be fetched.
        if (page != 1) throw new TripadvisorFailure(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Pagination requires Terra API mode");
        List<Location> places = search(query, category);
        return new SearchPage(places, 1, places.size(), (long) places.size(), 1, false);
    }

    public List<Location> search(String query, String category) {
        if ("TERRA".equals(apiMode)) return terra.search(query, category);
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
        if ("TERRA".equals(apiMode)) return terra.details(id);
        validateId(id);
        JsonNode node = get("/" + id + "/details", "currency", "INR");
        return new Details(id, text(node, "name"), text(node.path("address_obj"), "address_string"),
                text(node, "description"), safeUrl(text(node, "web_url"), false),
                safeUrl(text(node, "rating_image_url"), true), text(node, "num_reviews"));
    }
    public List<Photo> photos(String id) {
        if ("TERRA".equals(apiMode)) return terra.photos(id);
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
        if (!available()) throw new TripadvisorFailure(HttpStatus.SERVICE_UNAVAILABLE, "NOT_CONFIGURED", "Tripadvisor is not configured");
        budget.reserve();
        var builder = UriComponentsBuilder.fromUriString(BASE + path).queryParam("key", key).queryParam("language", "en");
        for (int i = 0; i < params.length; i += 2) builder.queryParam(params[i], params[i + 1]);
        try {
            var request = client.get().uri(builder.build().encode().toUri());
            if (!referer.isEmpty()) {
                request.header("Referer", referer);
                URI site = URI.create(referer);
                request.header("Origin", site.getScheme() + "://" + site.getAuthority());
            }
            JsonNode body = request.retrieve().body(JsonNode.class);
            if (body == null || body.has("error") || body.has("errors"))
                throw new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "PROVIDER_RESPONSE", "Tripadvisor returned an unavailable response");
            return body;
        } catch (RestClientResponseException ex) {
            // Never expose upstream exception text: its URL/body may contain the API key.
            int status = ex.getStatusCode().value();
            log.warn("Tripadvisor request rejected: operation={} status={}", path, status);
            if (status == 401 || status == 403)
                throw new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "ACCESS_DENIED",
                        "Tripadvisor rejected this connection. Check the API key, its allowed domain/IP and Content API v1 access.");
            if (status == 429)
                throw new TripadvisorFailure(HttpStatus.TOO_MANY_REQUESTS, "PROVIDER_LIMIT", "Tripadvisor request allowance reached. Please try later.");
            if (status == 404)
                throw new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "LOCATION_UNAVAILABLE", "This Tripadvisor location is unavailable.");
            throw new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "PROVIDER_UNAVAILABLE", "Tripadvisor is temporarily unavailable. Please try again later.");
        } catch (RestClientException ex) {
            log.warn("Tripadvisor connection failed: operation={} type={}", path, ex.getClass().getSimpleName());
            throw new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "CONNECTION_FAILED", "Unable to reach Tripadvisor. Please try again later.");
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
    private static String normalizeReferer(String value) {
        if (value == null || value.isBlank()) return "";
        try {
            URI uri = URI.create(value.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                    || uri.getRawQuery() != null || uri.getFragment() != null)
                throw new IllegalArgumentException();
            return uri.toString();
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("TRIPADVISOR_REFERER must be an HTTPS URL without credentials, query or fragment");
        }
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

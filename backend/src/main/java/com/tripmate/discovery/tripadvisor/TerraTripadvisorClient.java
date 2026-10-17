package com.tripmate.discovery.tripadvisor;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.provider.ProviderHttpClientFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import static com.tripmate.discovery.tripadvisor.TripadvisorService.*;

/** Read-only Terra v1 adapter. No catalog search, allowlist mutations, retries or content persistence. */
@Service
public class TerraTripadvisorClient {
    private static final String BASE = "https://terra.tripadvisor.com/api";
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(TerraTripadvisorClient.class);
    private final RestClient client;
    private final TripadvisorBudget budget;
    private final String key;
    @org.springframework.beans.factory.annotation.Autowired
    public TerraTripadvisorClient(ProviderHttpClientFactory factory, TripadvisorBudget budget,
            @Value("${discovery.tripadvisor.api-key:}") String key) {
        this(factory.create(10000), budget, key);
    }
    TerraTripadvisorClient(RestClient client, TripadvisorBudget budget, String key) {
        this.client = client; this.budget = budget; this.key = key == null ? "" : key.trim();
    }
    public boolean available() { return !key.isBlank() && budget.terraConfigured(); }
    public String setupCode() { return key.isBlank() ? "NOT_CONFIGURED" : !budget.terraConfigured() ? "TERRA_SETUP_REQUIRED" : ""; }

    public List<Location> search(String query, String category) {
        return searchPage(query, category, 1, 10).places();
    }
    public SearchPage searchPage(String query, String category, int page, int size) {
        validatePage(page, size);
        if (query == null || query.trim().length() < 2 || query.length() > 180
                || category == null || !Set.of("attractions", "hotels", "restaurants").contains(category))
            throw new TripadvisorFailure(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Choose a city or place and a supported category");
        String kind = switch (category) { case "hotels" -> "HOTEL"; case "restaurants" -> "RESTAURANT"; default -> "ATTRACTION"; };
        JsonNode response = get("/locations/search", size, "query", query.trim(), "search_type", "COMBINED", "country_code", "IN", "category", kind, "page", String.valueOf(page), "size", String.valueOf(size));
        List<Location> locations = new ArrayList<>();
        if (!response.path("data").isArray()) throw invalidResponse();
        for (JsonNode match : response.path("data")) {
            JsonNode node = match.path("location");
            String id = text(node, "id"), name = translated(node.path("names"));
            if (id == null || !id.matches("[0-9]{1,12}") || name == null) continue;
            locations.add(new Location(id, name, address(node), safeUrl(text(node.path("urls").path("tripadvisor"), "main"), false)));
            if (locations.size() == size) break;
        }
        JsonNode pagination = response.path("pagination");
        Long total = pagination.path("total_elements").canConvertToLong() && pagination.path("total_elements").asLong() >= 0
                ? pagination.path("total_elements").asLong() : null;
        Integer pages = pagination.path("total_pages").canConvertToInt() && pagination.path("total_pages").asInt() >= 0
                ? pagination.path("total_pages").asInt() : null;
        boolean hasNext = pages != null ? page < pages : total != null ? (long) page * size < total : response.path("data").size() >= size;
        return new SearchPage(locations, page, size, total, pages, hasNext);
    }
    public Details details(String id) {
        validateId(id);
        JsonNode node = get("/locations/" + id, 1);
        if (!id.equals(text(node, "id"))) throw invalidResponse();
        JsonNode overall = node.path("traveler_ratings").path("overall");
        return new Details(id, translated(node.path("names")), address(node), translated(node.path("descriptions")),
                safeUrl(text(node.path("urls").path("tripadvisor"), "main"), false),
                safeUrl(text(overall, "icon_url"), true), text(overall, "count"));
    }
    public List<Photo> photos(String id) {
        validateId(id);
        JsonNode response = get("/locations/" + id + "/photos", 1, "page", "1", "size", "1");
        if (!response.path("data").isArray()) throw invalidResponse();
        List<Photo> photos = new ArrayList<>();
        for (JsonNode node : response.path("data")) {
            // The photo response has no property-page URL. The UI links using the URL returned by search.
            String url = safeUrl(text(node.path("photo"), "original_size_url"), true);
            String author = text(node.path("user"), "username");
            String source = text(node.path("source"), "name");
            if (author == null && ("Management".equals(source) || "Traveler".equals(source))) author = source;
            if (url != null && author != null && id.equals(text(node, "location_id")))
                photos.add(new Photo(url, text(node, "caption"), author, null));
            if (photos.size() == 1) break;
        }
        return photos;
    }
    private JsonNode get(String path, int maximumEntities, String... params) {
        if (!available()) throw new TripadvisorFailure(HttpStatus.SERVICE_UNAVAILABLE, setupCode(),
                "Terra activation requires an API key and an explicit entity budget after checking your account allowance");
        budget.reserveTerra(maximumEntities);
        var uri = UriComponentsBuilder.fromUriString(BASE + path).queryParam("version", "1").queryParam("locale", "en-US");
        for (int i=0;i<params.length;i+=2) uri.queryParam(params[i], params[i+1]);
        try {
            JsonNode body = client.get().uri(uri.build().encode().toUri()).header("X-API-Key", key)
                    .header("Accept", "application/json").retrieve().body(JsonNode.class);
            if (body == null || body.has("type") && body.has("status")) throw invalidResponse();
            return body;
        } catch (RestClientResponseException ex) {
            int status=ex.getStatusCode().value();
            log.warn("Terra request rejected: operation={} status={}", path, status);
            if (status == 401) throw new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "TERRA_AUTHENTICATION", "Terra rejected the API key");
            if (status == 403) throw new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "TERRA_ACCESS_DENIED", "The Terra key does not have access to this endpoint. Check package and key permissions.");
            if (status == 404) throw new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "LOCATION_ACCESS_REQUIRED", "This location is missing or outside your Terra location access. Check allowed locations or contracted geography.");
            if (status == 429) throw new TripadvisorFailure(HttpStatus.TOO_MANY_REQUESTS, "PROVIDER_LIMIT", "Terra request limit reached. Please try later.");
            throw new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "PROVIDER_UNAVAILABLE", "Terra is temporarily unavailable");
        } catch (RestClientException ex) {
            log.warn("Terra connection failed: operation={} type={}", path, ex.getClass().getSimpleName());
            throw new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "CONNECTION_FAILED", "Unable to reach Terra");
        }
    }
    private static String text(JsonNode node, String key) {
        String s=node.path(key).asText(null); return s == null || s.isBlank() ? null : s;
    }
    private static String translated(JsonNode values) {
        if (!values.isArray()) return null;
        for (JsonNode value:values) if (value.path("primary").asBoolean(false) && text(value,"value") != null) return text(value,"value");
        for (JsonNode value:values) if (text(value,"value") != null) return text(value,"value");
        return null;
    }
    private static String address(JsonNode node) {
        for (JsonNode a:node.path("addresses")) if (text(a,"formatted") != null) return text(a,"formatted");
        return null;
    }
    private static void validateId(String id) {
        if (id == null || !id.matches("[0-9]{1,12}")) throw new TripadvisorFailure(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Invalid Tripadvisor location");
    }
    private static TripadvisorFailure invalidResponse() {
        return new TripadvisorFailure(HttpStatus.BAD_GATEWAY, "PROVIDER_RESPONSE", "Terra returned an unsupported response");
    }
}

package com.tripmate.discovery.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.DiscoverySuggestion;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Component
@Order(10)
public class NominatimGeocodingProvider implements GeocodingProvider {
    private final RestClient client;
    private final String baseUrl;

    public NominatimGeocodingProvider(
            ProviderHttpClientFactory factory,
            @Value("${discovery.nominatim-url:https://nominatim.openstreetmap.org}") String baseUrl
    ) {
        this.client = factory.create(15000);
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }

    @Override public String name() { return "Nominatim"; }

    @Override
    public Optional<GeocodedDestination> geocode(String query) {
        return search(query, 1).stream().findFirst();
    }

    @Override
    public List<DiscoverySuggestion> suggest(String query, int limit) {
        return search(query, limit).stream().map(result -> new DiscoverySuggestion(
                result.displayName(), result.city(), result.district(), result.state(),
                result.latitude(), result.longitude(), name()
        )).toList();
    }

    @Override
    public Optional<GeocodedDestination> reverse(BigDecimal latitude, BigDecimal longitude) {
        URI uri = UriComponentsBuilder.fromUri(ProviderUrlSupport.uri(baseUrl, "/reverse"))
                .queryParam("lat", latitude).queryParam("lon", longitude).queryParam("format", "jsonv2")
                .queryParam("addressdetails", 1).build().encode().toUri();
        JsonNode node = client.get().uri(uri).retrieve().body(JsonNode.class);
        if (node == null || node.path("error").isTextual()) return Optional.empty();
        JsonNode address = node.path("address");
        if (!"in".equalsIgnoreCase(address.path("country_code").asText())) return Optional.empty();
        return Optional.of(new GeocodedDestination(latitude, longitude, node.path("display_name").asText("Current location"),
                first(address, "city", "town", "village", "municipality"),
                first(address, "state_district", "county", "district"), address.path("state").asText(null), "IN", name()));
    }

    private List<GeocodedDestination> search(String query, int limit) {
        URI uri = UriComponentsBuilder.fromUri(ProviderUrlSupport.uri(baseUrl, "/search"))
                .queryParam("q", query + ", India").queryParam("format", "jsonv2")
                .queryParam("countrycodes", "in").queryParam("limit", Math.max(1, Math.min(limit, 8)))
                .queryParam("addressdetails", 1).build().encode().toUri();
        JsonNode response = client.get()
                .uri(uri)
                .retrieve().body(JsonNode.class);
        if (response == null || !response.isArray()) return List.of();
        List<GeocodedDestination> results = new ArrayList<>();
        for (JsonNode node : response) {
            BigDecimal lat = decimal(node.path("lat").asText(null));
            BigDecimal lon = decimal(node.path("lon").asText(null));
            JsonNode address = node.path("address");
            if (lat == null || lon == null || !"in".equalsIgnoreCase(address.path("country_code").asText("in"))) continue;
            results.add(new GeocodedDestination(lat, lon, node.path("display_name").asText(query),
                    first(address, "city", "town", "village", "municipality"),
                    first(address, "state_district", "county", "district"), address.path("state").asText(null),
                    "IN", name()));
        }
        return List.copyOf(results);
    }

    private String first(JsonNode node, String... names) {
        for (String name : names) if (!node.path(name).asText("").isBlank()) return node.path(name).asText();
        return null;
    }

    private BigDecimal decimal(String value) {
        try { return value == null ? null : new BigDecimal(value); } catch (NumberFormatException ex) { return null; }
    }
}

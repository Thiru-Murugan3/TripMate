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
@Order(20)
public class PhotonGeocodingProvider implements GeocodingProvider {
    private final RestClient client;
    private final String baseUrl;

    public PhotonGeocodingProvider(ProviderHttpClientFactory factory,
            @Value("${discovery.photon-url:https://photon.komoot.io}") String baseUrl) {
        this.client = factory.create(15000);
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }

    @Override public String name() { return "Photon"; }
    @Override public Optional<GeocodedDestination> geocode(String query) { return search(query, 5).stream().findFirst(); }
    @Override public List<DiscoverySuggestion> suggest(String query, int limit) {
        return search(query, limit).stream().map(result -> new DiscoverySuggestion(result.displayName(), result.city(),
                result.district(), result.state(), result.latitude(), result.longitude(), name())).toList();
    }

    private List<GeocodedDestination> search(String query, int limit) {
        URI uri = UriComponentsBuilder.fromUri(ProviderUrlSupport.uri(baseUrl, "/api"))
                .queryParam("q", query + ", India").queryParam("limit", Math.max(1, Math.min(limit, 8)))
                .queryParam("lang", "en").build().encode().toUri();
        JsonNode response = client.get().uri(uri)
                .retrieve().body(JsonNode.class);
        JsonNode features = response == null ? null : response.path("features");
        if (features == null || !features.isArray()) return List.of();
        List<GeocodedDestination> results = new ArrayList<>();
        for (JsonNode feature : features) {
            JsonNode properties = feature.path("properties");
            String countryCode = first(properties, "countrycode", "country_code");
            if (!("IN".equalsIgnoreCase(countryCode) || "India".equalsIgnoreCase(properties.path("country").asText()))) continue;
            JsonNode coordinates = feature.path("geometry").path("coordinates");
            if (!coordinates.isArray() || coordinates.size() < 2) continue;
            BigDecimal lon = decimal(coordinates.get(0).asText(null));
            BigDecimal lat = decimal(coordinates.get(1).asText(null));
            if (lat == null || lon == null) continue;
            String city = first(properties, "city", "town", "village", "name");
            String district = first(properties, "district", "county");
            String state = properties.path("state").asText(null);
            String label = String.join(", ", java.util.stream.Stream.of(city, district, state, "India")
                    .filter(value -> value != null && !value.isBlank()).distinct().toList());
            results.add(new GeocodedDestination(lat, lon, label, city, district, state, "IN", name()));
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

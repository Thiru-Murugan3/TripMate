package com.tripmate.place;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.provider.ProviderHttpClientFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Searches Photon (OpenStreetMap) for named points of interest such as forts, temples and markets.
 * The destination geocoders deliberately keep only towns and regions, so they can't find these.
 */
@Component
public class PointOfInterestLookup {

    public record Candidate(String name, String osmKey, BigDecimal latitude, BigDecimal longitude) {}

    private final RestClient client;
    private final String baseUrl;

    public PointOfInterestLookup(ProviderHttpClientFactory factory,
                                 @Value("${discovery.photon-url:https://photon.komoot.io}") String baseUrl) {
        this.client = factory.create(15000);
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }

    /** Indian results for the query, best first; roads and streets are skipped. */
    public List<Candidate> search(String query) {
        var uri = UriComponentsBuilder.fromUriString(baseUrl + "/api")
                .queryParam("q", query + ", India").queryParam("limit", 6).queryParam("lang", "en")
                .build().encode().toUri();
        JsonNode response = client.get().uri(uri).retrieve().body(JsonNode.class);
        JsonNode features = response == null ? null : response.path("features");
        if (features == null || !features.isArray()) return List.of();
        List<Candidate> out = new ArrayList<>();
        for (JsonNode feature : features) {
            JsonNode p = feature.path("properties");
            String key = p.path("osm_key").asText("");
            if ("highway".equals(key)) continue;
            String country = p.path("countrycode").asText(p.path("country_code").asText(""));
            if (!"IN".equalsIgnoreCase(country)) continue;
            JsonNode c = feature.path("geometry").path("coordinates");
            if (!c.isArray() || c.size() < 2 || !c.get(0).isNumber() || !c.get(1).isNumber()) continue;
            out.add(new Candidate(p.path("name").asText(""), key,
                    c.get(1).decimalValue(), c.get(0).decimalValue()));
        }
        return out;
    }
}

package com.tripmate.discovery.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.*;
import com.tripmate.place.PlaceCategory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Optional licensed provider. It remains inactive unless a Geoapify API key is configured. */
@Component
@Order(30)
public class GeoapifyDiscoveryProvider implements DiscoveryProvider {
    private final RestClient client;
    private final String apiKey;
    private final String baseUrl;

    public GeoapifyDiscoveryProvider(
            ProviderHttpClientFactory factory,
            @Value("${discovery.geoapify.api-key:}") String apiKey,
            @Value("${discovery.geoapify.url:https://api.geoapify.com}") String baseUrl
    ) {
        this.client = factory.create(12000);
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }

    @Override public String name() { return "Geoapify"; }

    @Override
    public DiscoveryProviderResult discover(DiscoveryProviderRequest request) {
        if (apiKey.isBlank()) return new DiscoveryProviderResult(name(), "", List.of(), List.of());
        double lat = request.destination().latitude().doubleValue();
        double lon = request.destination().longitude().doubleValue();
        URI uri = UriComponentsBuilder.fromUri(URI.create(baseUrl + "/v2/places"))
                .queryParam("categories", categories(request.category()))
                .queryParam("filter", "circle:" + lon + "," + lat + "," + request.radiusKm() * 1000)
                .queryParam("bias", "proximity:" + lon + "," + lat)
                .queryParam("limit", 100).queryParam("apiKey", apiKey).build().encode().toUri();
        JsonNode response = client.get().uri(uri).retrieve().body(JsonNode.class);
        JsonNode features = response == null ? null : response.path("features");
        if (features == null || !features.isArray()) return new DiscoveryProviderResult(name(), "Geoapify Places API", List.of(), List.of());
        List<DiscoveredPlace> places = new ArrayList<>();
        Instant checked = Instant.now();
        for (JsonNode feature : features) {
            JsonNode properties = feature.path("properties");
            String name = properties.path("name").asText(null);
            JsonNode coordinates = feature.path("geometry").path("coordinates");
            if (name == null || !coordinates.isArray() || coordinates.size() < 2) continue;
            BigDecimal longitude = decimal(coordinates.get(0).asText());
            BigDecimal latitude = decimal(coordinates.get(1).asText());
            if (latitude == null || longitude == null) continue;
            DiscoveryCategory category = classify(properties.path("categories"));
            if (request.category() != null && request.category() != category) continue;
            String placeId = properties.path("place_id").asText();
            double distance = haversine(lat, lon, latitude.doubleValue(), longitude.doubleValue());
            String website = properties.path("website").asText(null);
            Double rating = properties.path("rating").isNumber() ? properties.path("rating").asDouble() : null;
            places.add(new DiscoveredPlace(
                    "geoapify:" + placeId, name, category, latitude, longitude, Math.round(distance * 10) / 10.0,
                    90, properties.path("description").asText(null), null, properties.path("opening_hours").asText(null),
                    website, saveCategory(category), null, null, slug(name), itemType(category), null,
                    properties.path("city").asText(null), properties.path("district").asText(null),
                    properties.path("state").asText(null), properties.path("formatted").asText(null),
                    properties.path("formatted").asText(null), properties.path("description").asText(null),
                    properties.path("description").asText(null), null, List.of(), null, null, null, false,
                    null, 90, null, null, null, null, null, null, List.of(), List.of(), List.of(),
                    properties.path("wheelchair").asText(null), properties.path("contact").path("phone").asText(null),
                    website, null, null, "https://www.google.com/maps/dir/?api=1&destination=" + latitude + "," + longitude,
                    PriceStatus.UNKNOWN, PriceType.UNKNOWN, "INR", List.of(), name(),
                    "https://www.geoapify.com/places-api/", checked, null, false, .75, rating, null, 0, null, null, false
            ));
        }
        return new DiscoveryProviderResult(name(), "Places data © Geoapify and its data providers", places, List.of());
    }

    private String categories(DiscoveryCategory category) {
        if (category == DiscoveryCategory.FOOD) return "catering";
        if (category == DiscoveryCategory.STAY) return "accommodation";
        if (category == DiscoveryCategory.SHOPPING) return "commercial";
        if (category == DiscoveryCategory.ENTERTAINMENT || category == DiscoveryCategory.NIGHTLIFE) return "entertainment";
        return "tourism,entertainment,leisure,catering,accommodation,commercial";
    }
    private DiscoveryCategory classify(JsonNode categories) {
        String joined = categories.toString().toLowerCase(Locale.ROOT);
        if (joined.contains("catering")) return DiscoveryCategory.FOOD;
        if (joined.contains("accommodation")) return DiscoveryCategory.STAY;
        if (joined.contains("commercial")) return DiscoveryCategory.SHOPPING;
        if (joined.contains("nightclub")) return DiscoveryCategory.NIGHTLIFE;
        if (joined.contains("entertainment")) return DiscoveryCategory.ENTERTAINMENT;
        if (joined.contains("museum")) return DiscoveryCategory.MUSEUM;
        return DiscoveryCategory.ATTRACTION;
    }
    private DiscoveryItemType itemType(DiscoveryCategory category) {
        return switch (category) {
            case FOOD -> DiscoveryItemType.FOOD;
            case STAY -> DiscoveryItemType.STAY;
            case ENTERTAINMENT, NIGHTLIFE -> DiscoveryItemType.ACTIVITY;
            default -> DiscoveryItemType.PLACE;
        };
    }
    private PlaceCategory saveCategory(DiscoveryCategory category) {
        return switch (category) {
            case FOOD -> PlaceCategory.RESTAURANT;
            case STAY -> PlaceCategory.HOTEL;
            case SHOPPING -> PlaceCategory.SHOPPING;
            case ENTERTAINMENT, NIGHTLIFE -> PlaceCategory.ACTIVITY;
            default -> PlaceCategory.ATTRACTION;
        };
    }
    private BigDecimal decimal(String value) { try { return new BigDecimal(value); } catch (Exception ex) { return null; } }
    private String slug(String value) { return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", ""); }
    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}

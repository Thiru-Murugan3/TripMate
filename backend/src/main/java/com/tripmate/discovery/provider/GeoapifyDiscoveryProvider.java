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
        this.client = factory.create(3500);
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }

    @Override public String name() { return "Geoapify"; }

    @Override
    public DiscoveryProviderResult discover(DiscoveryProviderRequest request) {
        if (apiKey.isBlank()) return new DiscoveryProviderResult(name(), "", List.of(), List.of("Geoapify is inactive until its backend API key is configured."));
        double lat = request.destination().latitude().doubleValue();
        double lon = request.destination().longitude().doubleValue();
        var features = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        List<String> warnings = new ArrayList<>();
        long deadline=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(7);
        for (int offset = 0; offset < 300; offset += 100) {
            if(request.fast() && offset>0 && System.nanoTime()+java.util.concurrent.TimeUnit.MILLISECONDS.toNanos(3500)>deadline) {
                warnings.add("Geoapify search time limit reached; earlier pages are retained.");break;
            }
            URI uri = UriComponentsBuilder.fromUri(URI.create(baseUrl + "/v2/places"))
                    .queryParam("categories", categories(request.category()))
                    .queryParam("filter", "circle:" + lon + "," + lat + "," + request.radiusKm() * 1000)
                    .queryParam("bias", "proximity:" + lon + "," + lat)
                    .queryParam("limit", 100).queryParam("offset", offset).queryParam("apiKey", apiKey).build().encode().toUri();
            try {
                JsonNode response = client.get().uri(uri).retrieve().body(JsonNode.class);
                JsonNode page = response == null ? null : response.path("features");
                if (page == null || !page.isArray()) throw new IllegalStateException("Unsupported Geoapify response");
                features.addAll((com.fasterxml.jackson.databind.node.ArrayNode) page);
                if (page.size() < 100) break;
                if (offset == 200) warnings.add("Geoapify reached the configured 300-place retrieval limit; narrow the category or radius for a more focused search.");
            } catch (org.springframework.web.client.RestClientException | IllegalStateException ex) {
                if (features.isEmpty()) throw ex;
                warnings.add("Additional Geoapify results were unavailable; earlier pages are retained.");
                break;
            }
        }
        List<DiscoveredPlace> places = new ArrayList<>();
        Instant checked = Instant.now();
        for (JsonNode feature : features) {
            JsonNode properties = feature.path("properties");
            String name = properties.path("name").asText(null);
            JsonNode coordinates = feature.path("geometry").path("coordinates");
            if (name == null || !coordinates.isArray() || coordinates.size() < 2) continue;
            JsonNode raw=properties.path("datasource").path("raw");
            if ((request.placeName()==null || request.placeName().isBlank()) && incidental(properties.path("categories"),raw)) continue;
            BigDecimal longitude = decimal(coordinates.get(0).asText());
            BigDecimal latitude = decimal(coordinates.get(1).asText());
            if (latitude == null || longitude == null) continue;
            DiscoveryCategory category = classify(properties.path("categories"), name);
            if (!DiscoveryCategoryMatching.matches(request.category(), category)) continue;
            String placeId = properties.path("place_id").asText();
            double distance = haversine(lat, lon, latitude.doubleValue(), longitude.doubleValue());
            String website = properties.path("website").asText(null);
            String hours=properties.path("opening_hours").asText("").trim();
            if(hours.isEmpty()) hours=raw.path("opening_hours").asText("").trim();
            Integer sourceDuration=SourceDuration.minutes(raw.path("duration").asText(null));
            int duration=sourceDuration==null ? 90 : sourceDuration;
            Double rating = properties.path("rating").isNumber() ? properties.path("rating").asDouble() : null;
            places.add(new DiscoveredPlace(
                    "geoapify:" + placeId, name, category, latitude, longitude, Math.round(distance * 10) / 10.0,
                    duration, properties.path("description").asText(null), null, hours.isEmpty() ? null : hours,
                    website, saveCategory(category), null, null, slug(name), itemType(category), null,
                    properties.path("city").asText(null), properties.path("district").asText(null),
                    properties.path("state").asText(null), properties.path("formatted").asText(null),
                    properties.path("formatted").asText(null), properties.path("description").asText(null),
                    properties.path("description").asText(null), null, List.of(), null, null, null, false,
                    null, duration, null, null, null, null, null, null, List.of(), List.of(), List.of(),
                    properties.path("wheelchair").asText(null), properties.path("contact").path("phone").asText(null),
                    website, null, null, "https://www.google.com/maps/dir/?api=1&destination=" + latitude + "," + longitude,
                    PriceStatus.UNKNOWN, PriceType.UNKNOWN, "INR", List.of(), name(),
                    sourcePage(raw), checked, null, false, .75, rating, null, 0, null, null, false
            ));
        }
        return new DiscoveryProviderResult(name(), "Places data © Geoapify and its data providers", places, warnings);
    }

    private String sourcePage(JsonNode raw) {
        String id=raw.path("osm_id").asText("");String type=raw.path("osm_type").asText("").toLowerCase(Locale.ROOT);
        type=switch(type){case "n","node"->"node";case "w","way"->"way";case "r","relation"->"relation";default->"";};
        return !type.isEmpty()&&id.matches("[1-9][0-9]{0,18}") ? "https://www.openstreetmap.org/"+type+"/"+id : "https://www.geoapify.com/places-api/";
    }
    private String categories(DiscoveryCategory category) {
        if (category == DiscoveryCategory.ADVENTURE) return "sport,entertainment,leisure,tourism";
        if (category == DiscoveryCategory.FAMILY) return "leisure,entertainment,tourism";
        if (category == DiscoveryCategory.FOOD) return "catering";
        if (category == DiscoveryCategory.STAY) return "accommodation";
        if (category == DiscoveryCategory.SHOPPING) return "commercial";
        if (category == DiscoveryCategory.ENTERTAINMENT || category == DiscoveryCategory.NIGHTLIFE) return "entertainment";
        return "tourism,entertainment,leisure";
    }
    private boolean incidental(JsonNode categories,JsonNode raw) {
        String tags=categories.toString().toLowerCase(Locale.ROOT);
        // A positive visitor designation wins over a secondary sports tag.
        if(tags.contains("tourism") || tags.contains("museum") || tags.contains("theme_park") || tags.contains("water_park"))return false;
        String leisure=raw.path("leisure").asText("");
        return List.of("pitch","sports_centre","fitness_station","track").contains(leisure)
                || tags.contains("sport.pitch") || tags.contains("sport.sports_centre");
    }
    private DiscoveryCategory classify(JsonNode categories, String name) {
        String joined = categories.toString().toLowerCase(Locale.ROOT);
        if (joined.contains("catering")) return DiscoveryCategory.FOOD;
        if (joined.contains("accommodation")) return DiscoveryCategory.STAY;
        if (joined.contains("commercial")) return DiscoveryCategory.SHOPPING;
        if (joined.contains("nightclub")) return DiscoveryCategory.NIGHTLIFE;
        if ((joined.contains("tourism") || joined.contains("sport") || joined.contains("entertainment"))
                && name.toLowerCase(Locale.ROOT).matches(".*\\b(rafting|bungee|zip.?line|paragliding|adventure|trekking)\\b.*")) return DiscoveryCategory.ADVENTURE;
        if (joined.matches(".*(rafting|canoe|kayak|climbing|paragliding|bungee|zipline|dive_centre|horse_riding|adventure).*")) return DiscoveryCategory.ADVENTURE;
        if (joined.contains("museum")) return DiscoveryCategory.MUSEUM;
        if (joined.contains("playground") || joined.contains("zoo") || joined.contains("aquarium")) return DiscoveryCategory.FAMILY;
        if (joined.contains("theme_park") || joined.contains("water_park")) return DiscoveryCategory.ENTERTAINMENT;
        if (joined.contains("park") || joined.contains("garden")) return DiscoveryCategory.PARK;
        if (joined.contains("entertainment")) return DiscoveryCategory.ENTERTAINMENT;
        if (joined.contains("waterfall")) return DiscoveryCategory.WATERFALL;
        if (joined.contains("beach")) return DiscoveryCategory.BEACH;
        if (joined.contains("lake")) return DiscoveryCategory.LAKE;
        if (joined.contains("river")) return DiscoveryCategory.RIVER;
        if (joined.contains("viewpoint")) return DiscoveryCategory.VIEWPOINT;
        if (joined.contains("natural")) return DiscoveryCategory.NATURE;
        if (joined.contains("church")) return DiscoveryCategory.CHURCH;
        if (joined.contains("place_of_worship")) return DiscoveryCategory.TEMPLE;
        return DiscoveryCategory.ATTRACTION;
    }
    private DiscoveryItemType itemType(DiscoveryCategory category) {
        return switch (category) {
            case FOOD -> DiscoveryItemType.FOOD;
            case STAY -> DiscoveryItemType.STAY;
            case ADVENTURE, FAMILY, ENTERTAINMENT, NIGHTLIFE -> DiscoveryItemType.ACTIVITY;
            default -> DiscoveryItemType.PLACE;
        };
    }
    private PlaceCategory saveCategory(DiscoveryCategory category) {
        return switch (category) {
            case FOOD -> PlaceCategory.RESTAURANT;
            case STAY -> PlaceCategory.HOTEL;
            case SHOPPING -> PlaceCategory.SHOPPING;
            case ADVENTURE, FAMILY, ENTERTAINMENT, NIGHTLIFE -> PlaceCategory.ACTIVITY;
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

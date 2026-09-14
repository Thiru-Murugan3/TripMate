package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.place.PlaceCategory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DestinationDiscoveryService {

    private static final String PROVIDER = "OpenStreetMap";
    private static final String ATTRIBUTION = "© OpenStreetMap contributors";

    private final RestClient nominatimClient;
    private final RestClient overpassClient;
    private final Duration cacheDuration;
    private final int maxResults;
    private final Map<String, CachedResult> cache = new ConcurrentHashMap<>();

    public DestinationDiscoveryService(
            @Value("${discovery.nominatim-url:https://nominatim.openstreetmap.org}") String nominatimUrl,
            @Value("${discovery.overpass-url:https://overpass-api.de/api/interpreter}") String overpassUrl,
            @Value("${discovery.user-agent:TripMate/1.0 (development)}") String userAgent,
            @Value("${discovery.cache-minutes:60}") long cacheMinutes,
            @Value("${discovery.max-results:200}") int maxResults
    ) {
        this.nominatimClient = RestClient.builder()
                .baseUrl(nominatimUrl)
                .defaultHeader("User-Agent", userAgent)
                .defaultHeader("Accept-Language", "en")
                .build();
        this.overpassClient = RestClient.builder()
                .baseUrl(overpassUrl)
                .defaultHeader("User-Agent", userAgent)
                .build();
        this.cacheDuration = Duration.ofMinutes(Math.max(5, cacheMinutes));
        this.maxResults = Math.max(25, Math.min(500, maxResults));
    }

    public DestinationDiscoveryResponse search(String destination, int radiusKm, String categoryValue) {
        String cleanDestination = destination == null ? "" : destination.trim();
        if (cleanDestination.length() < 2 || cleanDestination.length() > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination must be between 2 and 180 characters");
        }
        if (radiusKm < 1 || radiusKm > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Radius must be between 1 and 50 km");
        }

        DiscoveryCategory category = parseCategory(categoryValue);
        String cacheKey = cleanDestination.toLowerCase(Locale.ROOT) + "|" + radiusKm + "|" + (category == null ? "ALL" : category.name());
        CachedResult cached = cache.get(cacheKey);
        if (cached != null && cached.createdAt().plus(cacheDuration).isAfter(Instant.now())) {
            return cached.response();
        }

        try {
            GeoPoint destinationPoint = geocode(cleanDestination);
            List<DiscoveredPlace> discovered = fetchPlaces(destinationPoint, radiusKm, category, cleanDestination);

            DestinationDiscoveryResponse response = new DestinationDiscoveryResponse(
                    cleanDestination,
                    destinationPoint.displayName(),
                    destinationPoint.latitude(),
                    destinationPoint.longitude(),
                    radiusKm,
                    category == null ? "ALL" : category.name(),
                    PROVIDER,
                    ATTRIBUTION,
                    discovered.size(),
                    discovered
            );
            cache.put(cacheKey, new CachedResult(Instant.now(), response));
            return response;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Tourist place provider is temporarily unavailable. Please try again.",
                    ex
            );
        }
    }

    private GeoPoint geocode(String destination) {
        JsonNode response = nominatimClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/search")
                        .queryParam("q", destination)
                        .queryParam("format", "jsonv2")
                        .queryParam("limit", 1)
                        .queryParam("addressdetails", 1)
                        .build())
                .retrieve()
                .body(JsonNode.class);

        if (response == null || !response.isArray() || response.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Destination could not be found");
        }

        JsonNode first = response.get(0);
        BigDecimal latitude = decimal(first.path("lat").asText(null));
        BigDecimal longitude = decimal(first.path("lon").asText(null));
        if (latitude == null || longitude == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Location provider returned invalid coordinates");
        }

        String displayName = first.path("display_name").asText(destination);
        return new GeoPoint(latitude, longitude, displayName);
    }

    private List<DiscoveredPlace> fetchPlaces(
            GeoPoint center,
            int radiusKm,
            DiscoveryCategory category,
            String destination
    ) {
        String query = buildOverpassQuery(
                center.latitude().doubleValue(),
                center.longitude().doubleValue(),
                radiusKm * 1000,
                category
        );

        String encodedBody = "data=" + URLEncoder.encode(query, StandardCharsets.UTF_8);
        JsonNode response = overpassClient.post()
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(encodedBody)
                .retrieve()
                .body(JsonNode.class);

        JsonNode elements = response == null ? null : response.path("elements");
        if (elements == null || !elements.isArray()) {
            return List.of();
        }

        Map<String, DiscoveredPlace> deduplicated = new LinkedHashMap<>();
        for (JsonNode element : elements) {
            JsonNode tags = element.path("tags");
            if (!tags.isObject()) continue;

            String name = firstNonBlank(tags.path("name").asText(null), tags.path("name:en").asText(null));
            if (name == null || name.isBlank()) continue;

            BigDecimal lat = decimal(element.path("lat").asText(null));
            BigDecimal lon = decimal(element.path("lon").asText(null));
            if (lat == null || lon == null) {
                lat = decimal(element.path("center").path("lat").asText(null));
                lon = decimal(element.path("center").path("lon").asText(null));
            }
            if (lat == null || lon == null) continue;

            DiscoveryCategory mappedCategory = classify(tags, name);
            if (category != null && mappedCategory != category) continue;

            double distanceKm = haversineKm(
                    center.latitude().doubleValue(),
                    center.longitude().doubleValue(),
                    lat.doubleValue(),
                    lon.doubleValue()
            );

            if (distanceKm > radiusKm + 0.2) continue;

            String type = element.path("type").asText("element");
            String id = element.path("id").asText();
            String externalId = "osm:" + type + ":" + id;

            String description = firstNonBlank(
                    tags.path("description").asText(null),
                    tags.path("inscription").asText(null)
            );

            String imageUrl = resolveImage(tags);
            String openingHours = emptyToNull(tags.path("opening_hours").asText(null));
            String website = firstNonBlank(
                    tags.path("website").asText(null),
                    tags.path("contact:website").asText(null)
            );

            DiscoveredPlace place = new DiscoveredPlace(
                    externalId,
                    name.trim(),
                    mappedCategory,
                    lat.setScale(6, RoundingMode.HALF_UP),
                    lon.setScale(6, RoundingMode.HALF_UP),
                    roundDistance(distanceKm),
                    suggestedVisitMinutes(mappedCategory),
                    description != null ? description : "Tourist place near " + destination,
                    imageUrl,
                    openingHours,
                    website,
                    toSavedPlaceCategory(mappedCategory)
            );

            String dedupeKey = name.trim().toLowerCase(Locale.ROOT)
                    + "|" + lat.setScale(3, RoundingMode.HALF_UP)
                    + "|" + lon.setScale(3, RoundingMode.HALF_UP);
            deduplicated.putIfAbsent(dedupeKey, place);
        }

        return deduplicated.values().stream()
                .sorted(Comparator
                        .comparingDouble(DiscoveredPlace::distanceKm)
                        .thenComparing(DiscoveredPlace::name, String.CASE_INSENSITIVE_ORDER))
                .limit(maxResults)
                .toList();
    }

    String buildOverpassQuery(double lat, double lon, int radiusMeters, DiscoveryCategory category) {
        String around = "(around:" + radiusMeters + "," + lat + "," + lon + ")";
        List<String> selectors = new ArrayList<>();

        if (category == DiscoveryCategory.FOOD) {
            selectors.add("nwr" + around + "[\"amenity\"~\"restaurant|cafe|fast_food|food_court\"];");
        } else if (category == DiscoveryCategory.SHOPPING) {
            selectors.add("nwr" + around + "[\"amenity\"=\"marketplace\"];");
            selectors.add("nwr" + around + "[\"shop\"~\"mall|gift|art|craft|souvenir\"];");
        } else {
            selectors.add("nwr" + around + "[\"tourism\"];");
            selectors.add("nwr" + around + "[\"historic\"];");
            selectors.add("nwr" + around + "[\"natural\"~\"waterfall|peak|beach|cave_entrance|spring|water\"];");
            selectors.add("nwr" + around + "[\"water\"~\"lake|reservoir\"];");
            selectors.add("nwr" + around + "[\"leisure\"~\"park|garden|nature_reserve|water_park|theme_park\"];");
            selectors.add("nwr" + around + "[\"amenity\"=\"place_of_worship\"];");
            selectors.add("nwr" + around + "[\"amenity\"=\"marketplace\"];");
        }

        return "[out:json][timeout:25];(" + String.join("", selectors) + ");out center tags;";
    }

    DiscoveryCategory classify(JsonNode tags, String name) {
        String tourism = tags.path("tourism").asText("");
        String natural = tags.path("natural").asText("");
        String water = tags.path("water").asText("");
        String historic = tags.path("historic").asText("");
        String leisure = tags.path("leisure").asText("");
        String amenity = tags.path("amenity").asText("");
        String shop = tags.path("shop").asText("");
        String religion = tags.path("religion").asText("");
        String lowerName = name.toLowerCase(Locale.ROOT);

        if ("waterfall".equals(natural) || lowerName.contains("waterfall") || lowerName.contains("falls")) {
            return DiscoveryCategory.WATERFALL;
        }
        if ("lake".equals(water) || "reservoir".equals(water) || lowerName.contains(" lake")) {
            return DiscoveryCategory.LAKE;
        }
        if ("viewpoint".equals(tourism) || lowerName.contains("view point") || lowerName.contains("viewpoint")) {
            return DiscoveryCategory.VIEWPOINT;
        }
        if ("museum".equals(tourism) || "museum".equals(amenity)) {
            return DiscoveryCategory.MUSEUM;
        }
        if (!historic.isBlank()) {
            return DiscoveryCategory.HISTORICAL;
        }
        if ("place_of_worship".equals(amenity)) {
            if ("christian".equals(religion)
                    || lowerName.contains("church")
                    || lowerName.contains("cathedral")
                    || lowerName.contains("chapel")) {
                return DiscoveryCategory.CHURCH;
            }
            return DiscoveryCategory.TEMPLE;
        }
        if ("park".equals(leisure) || "garden".equals(leisure)) {
            return DiscoveryCategory.PARK;
        }
        if ("nature_reserve".equals(leisure)
                || "peak".equals(natural)
                || "beach".equals(natural)
                || "cave_entrance".equals(natural)
                || "spring".equals(natural)
                || "water".equals(natural)) {
            return DiscoveryCategory.NATURE;
        }
        if ("water_park".equals(leisure)
                || "theme_park".equals(leisure)
                || "adventure_park".equals(tourism)) {
            return DiscoveryCategory.ADVENTURE;
        }
        if ("marketplace".equals(amenity) || !shop.isBlank()) {
            return DiscoveryCategory.SHOPPING;
        }
        if (amenity.matches("restaurant|cafe|fast_food|food_court")) {
            return DiscoveryCategory.FOOD;
        }
        return DiscoveryCategory.ATTRACTION;
    }

    PlaceCategory toSavedPlaceCategory(DiscoveryCategory category) {
        return switch (category) {
            case FOOD -> PlaceCategory.RESTAURANT;
            case SHOPPING -> PlaceCategory.SHOPPING;
            case ADVENTURE -> PlaceCategory.ACTIVITY;
            default -> PlaceCategory.ATTRACTION;
        };
    }

    int suggestedVisitMinutes(DiscoveryCategory category) {
        return switch (category) {
            case MUSEUM, HISTORICAL, ADVENTURE -> 120;
            case PARK, NATURE, WATERFALL, LAKE -> 90;
            case FOOD -> 75;
            case SHOPPING -> 90;
            default -> 60;
        };
    }

    private String resolveImage(JsonNode tags) {
        String image = emptyToNull(tags.path("image").asText(null));
        if (image != null && (image.startsWith("https://") || image.startsWith("http://"))) {
            return image;
        }

        String commons = emptyToNull(tags.path("wikimedia_commons").asText(null));
        if (commons != null && commons.toLowerCase(Locale.ROOT).startsWith("file:")) {
            String fileName = commons.substring(5).trim();
            return "https://commons.wikimedia.org/wiki/Special:FilePath/"
                    + URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
        }
        return null;
    }

    private DiscoveryCategory parseCategory(String value) {
        if (value == null || value.isBlank() || "ALL".equalsIgnoreCase(value)) {
            return null;
        }
        try {
            return DiscoveryCategory.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported discovery category");
        }
    }

    private BigDecimal decimal(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value.trim();
        }
        return null;
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusKm = 6371.0088;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private double roundDistance(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private record GeoPoint(BigDecimal latitude, BigDecimal longitude, String displayName) {
    }

    private record CachedResult(Instant createdAt, DestinationDiscoveryResponse response) {
    }
}

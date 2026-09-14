package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.place.PlaceCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

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

    private static final Logger log = LoggerFactory.getLogger(DestinationDiscoveryService.class);
    private static final String PROVIDER = "OpenStreetMap";
    private static final String ATTRIBUTION = "© OpenStreetMap contributors";

    private final RestClient nominatimClient;
    private final RestClient photonClient;
    private final RestClient overpassClient;
    private final String nominatimUrl;
    private final String photonUrl;
    private final List<String> overpassUrls;
    private final Duration cacheDuration;
    private final int maxResults;
    private final Map<String, CachedResult> cache = new ConcurrentHashMap<>();

    public DestinationDiscoveryService(
            @Value("${discovery.nominatim-url:https://nominatim.openstreetmap.org}") String nominatimUrl,
            @Value("${discovery.photon-url:https://photon.komoot.io}") String photonUrl,
            @Value("${discovery.overpass-urls:https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass.maprva.org/api/interpreter}") String overpassUrls,
            @Value("${discovery.user-agent:TripMate/1.0 (+https://github.com/Thiru-Murugan3/TripMate)}") String userAgent,
            @Value("${discovery.connect-timeout-ms:8000}") int connectTimeoutMs,
            @Value("${discovery.read-timeout-ms:35000}") int readTimeoutMs,
            @Value("${discovery.cache-minutes:60}") long cacheMinutes,
            @Value("${discovery.max-results:200}") int maxResults
    ) {
        this.nominatimUrl = stripTrailingSlash(nominatimUrl);
        this.photonUrl = stripTrailingSlash(photonUrl);
        this.overpassUrls = parseProviderUrls(overpassUrls);

        this.nominatimClient = buildClient(userAgent, connectTimeoutMs, Math.min(readTimeoutMs, 15000));
        this.photonClient = buildClient(userAgent, connectTimeoutMs, Math.min(readTimeoutMs, 15000));
        this.overpassClient = buildClient(userAgent, connectTimeoutMs, readTimeoutMs);

        this.cacheDuration = Duration.ofMinutes(Math.max(5, cacheMinutes));
        this.maxResults = Math.max(25, Math.min(500, maxResults));
    }

    public DestinationDiscoveryResponse search(String destination, int radiusKm, String categoryValue) {
        String cleanDestination = destination == null ? "" : destination.trim();
        if (cleanDestination.length() < 2 || cleanDestination.length() > 180) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Destination must be between 2 and 180 characters"
            );
        }
        if (radiusKm < 1 || radiusKm > 50) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Radius must be between 1 and 50 km"
            );
        }

        DiscoveryCategory category = parseCategory(categoryValue);
        String cacheKey = cleanDestination.toLowerCase(Locale.ROOT)
                + "|" + radiusKm
                + "|" + (category == null ? "ALL" : category.name());

        CachedResult cached = cache.get(cacheKey);
        if (cached != null && cached.createdAt().plus(cacheDuration).isAfter(Instant.now())) {
            return cached.response();
        }

        GeoPoint destinationPoint = geocodeWithFallback(cleanDestination);
        List<DiscoveredPlace> discovered = fetchPlacesWithFallback(
                destinationPoint,
                radiusKm,
                category,
                cleanDestination
        );

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
    }

    private GeoPoint geocodeWithFallback(String destination) {
        boolean anyProviderAnswered = false;

        try {
            GeoPoint result = geocodeNominatim(destination);
            anyProviderAnswered = true;
            if (result != null) {
                return result;
            }
        } catch (RestClientException ex) {
            log.warn("Destination discovery geocoder failed: provider=Nominatim error={}",
                    ex.getClass().getSimpleName());
        }

        try {
            GeoPoint result = geocodePhoton(destination);
            anyProviderAnswered = true;
            if (result != null) {
                return result;
            }
        } catch (RestClientException ex) {
            log.warn("Destination discovery geocoder failed: provider=Photon error={}",
                    ex.getClass().getSimpleName());
        }

        if (anyProviderAnswered) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Destination could not be found. Try a more specific name such as 'Ooty, Tamil Nadu'."
            );
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Destination lookup providers are temporarily unavailable. Please try again."
        );
    }

    private GeoPoint geocodeNominatim(String destination) {
        JsonNode response = nominatimClient.get()
                .uri(uriBuilder -> uriBuilder
                        .scheme("https")
                        .host(hostFromHttpsUrl(nominatimUrl))
                        .path(pathFromHttpsUrl(nominatimUrl, "/search"))
                        .queryParam("q", destination)
                        .queryParam("format", "jsonv2")
                        .queryParam("limit", 1)
                        .queryParam("addressdetails", 1)
                        .build())
                .retrieve()
                .body(JsonNode.class);

        if (response == null || !response.isArray() || response.isEmpty()) {
            return null;
        }

        JsonNode first = response.get(0);
        BigDecimal latitude = decimal(first.path("lat").asText(null));
        BigDecimal longitude = decimal(first.path("lon").asText(null));
        if (latitude == null || longitude == null) {
            return null;
        }

        String displayName = first.path("display_name").asText(destination);
        return new GeoPoint(latitude, longitude, displayName);
    }

    private GeoPoint geocodePhoton(String destination) {
        JsonNode response = photonClient.get()
                .uri(uriBuilder -> uriBuilder
                        .scheme("https")
                        .host(hostFromHttpsUrl(photonUrl))
                        .path(pathFromHttpsUrl(photonUrl, "/api"))
                        .queryParam("q", destination)
                        .queryParam("limit", 1)
                        .queryParam("lang", "en")
                        .build())
                .retrieve()
                .body(JsonNode.class);

        JsonNode features = response == null ? null : response.path("features");
        if (features == null || !features.isArray() || features.isEmpty()) {
            return null;
        }

        JsonNode first = features.get(0);
        JsonNode coordinates = first.path("geometry").path("coordinates");
        if (!coordinates.isArray() || coordinates.size() < 2) {
            return null;
        }

        BigDecimal longitude = decimal(coordinates.get(0).asText(null));
        BigDecimal latitude = decimal(coordinates.get(1).asText(null));
        if (latitude == null || longitude == null) {
            return null;
        }

        JsonNode properties = first.path("properties");
        String displayName = joinNonBlank(
                properties.path("name").asText(null),
                properties.path("city").asText(null),
                properties.path("state").asText(null),
                properties.path("country").asText(null)
        );

        return new GeoPoint(
                latitude,
                longitude,
                displayName == null ? destination : displayName
        );
    }

    private List<DiscoveredPlace> fetchPlacesWithFallback(
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

        for (int index = 0; index < overpassUrls.size(); index++) {
            String endpoint = overpassUrls.get(index);

            try {
                JsonNode response = overpassClient.post()
                        .uri(endpoint)
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(encodedBody)
                        .retrieve()
                        .body(JsonNode.class);

                List<DiscoveredPlace> places = mapOverpassPlaces(
                        response,
                        center,
                        radiusKm,
                        category,
                        destination
                );

                if (index > 0) {
                    log.info("Destination discovery recovered using Overpass fallback provider #{}.", index + 1);
                }
                return places;
            } catch (RestClientException ex) {
                log.warn(
                        "Destination discovery Overpass provider failed: providerIndex={} error={}",
                        index + 1,
                        ex.getClass().getSimpleName()
                );
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Tourist place providers are temporarily unavailable. TripMate tried "
                        + overpassUrls.size()
                        + " map providers. Please try again in a moment."
        );
    }

    private List<DiscoveredPlace> mapOverpassPlaces(
            JsonNode response,
            GeoPoint center,
            int radiusKm,
            DiscoveryCategory category,
            String destination
    ) {
        JsonNode elements = response == null ? null : response.path("elements");
        if (elements == null || !elements.isArray()) {
            return List.of();
        }

        Map<String, DiscoveredPlace> deduplicated = new LinkedHashMap<>();

        for (JsonNode element : elements) {
            JsonNode tags = element.path("tags");
            if (!tags.isObject()) {
                continue;
            }

            String name = firstNonBlank(
                    tags.path("name").asText(null),
                    tags.path("name:en").asText(null)
            );
            if (name == null || name.isBlank()) {
                continue;
            }

            BigDecimal lat = decimal(element.path("lat").asText(null));
            BigDecimal lon = decimal(element.path("lon").asText(null));

            if (lat == null || lon == null) {
                lat = decimal(element.path("center").path("lat").asText(null));
                lon = decimal(element.path("center").path("lon").asText(null));
            }

            if (lat == null || lon == null) {
                continue;
            }

            DiscoveryCategory mappedCategory = classify(tags, name);
            if (category != null && mappedCategory != category) {
                continue;
            }

            double distanceKm = haversineKm(
                    center.latitude().doubleValue(),
                    center.longitude().doubleValue(),
                    lat.doubleValue(),
                    lon.doubleValue()
            );

            if (distanceKm > radiusKm + 0.2) {
                continue;
            }

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
                .sorted(
                        Comparator.comparingDouble(DiscoveredPlace::distanceKm)
                                .thenComparing(
                                        DiscoveredPlace::name,
                                        String.CASE_INSENSITIVE_ORDER
                                )
                )
                .limit(maxResults)
                .toList();
    }

    String buildOverpassQuery(
            double lat,
            double lon,
            int radiusMeters,
            DiscoveryCategory category
    ) {
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

        return "[out:json][timeout:25];("
                + String.join("", selectors)
                + ");out center tags;";
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

        if ("waterfall".equals(natural)
                || lowerName.contains("waterfall")
                || lowerName.contains("falls")) {
            return DiscoveryCategory.WATERFALL;
        }

        if ("lake".equals(water)
                || "reservoir".equals(water)
                || lowerName.contains(" lake")) {
            return DiscoveryCategory.LAKE;
        }

        if ("viewpoint".equals(tourism)
                || lowerName.contains("view point")
                || lowerName.contains("viewpoint")) {
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

    List<String> configuredOverpassUrls() {
        return overpassUrls;
    }

    private RestClient buildClient(
            String userAgent,
            int connectTimeoutMs,
            int readTimeoutMs
    ) {
        SimpleClientHttpRequestFactory requestFactory =
                new SimpleClientHttpRequestFactory();

        requestFactory.setConnectTimeout(Math.max(1000, connectTimeoutMs));
        requestFactory.setReadTimeout(Math.max(3000, readTimeoutMs));

        return RestClient.builder()
                .requestFactory(requestFactory)
                .defaultHeader("User-Agent", userAgent)
                .defaultHeader("Accept-Language", "en")
                .build();
    }

    private List<String> parseProviderUrls(String csv) {
        List<String> urls = new ArrayList<>();

        if (csv != null) {
            for (String raw : csv.split(",")) {
                String value = raw.trim();
                if (!value.isBlank() && value.startsWith("https://")) {
                    urls.add(value);
                }
            }
        }

        if (urls.isEmpty()) {
            urls.add("https://overpass-api.de/api/interpreter");
        }

        return List.copyOf(urls);
    }

    private String resolveImage(JsonNode tags) {
        String image = emptyToNull(tags.path("image").asText(null));
        if (image != null
                && (image.startsWith("https://") || image.startsWith("http://"))) {
            return image;
        }

        String commons = emptyToNull(tags.path("wikimedia_commons").asText(null));
        if (commons != null
                && commons.toLowerCase(Locale.ROOT).startsWith("file:")) {
            String fileName = commons.substring(5).trim();
            return "https://commons.wikimedia.org/wiki/Special:FilePath/"
                    + URLEncoder.encode(fileName, StandardCharsets.UTF_8)
                    .replace("+", "%20");
        }

        return null;
    }

    private DiscoveryCategory parseCategory(String value) {
        if (value == null
                || value.isBlank()
                || "ALL".equalsIgnoreCase(value)) {
            return null;
        }

        try {
            return DiscoveryCategory.valueOf(
                    value.trim().toUpperCase(Locale.ROOT)
            );
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unsupported discovery category"
            );
        }
    }

    private BigDecimal decimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return new BigDecimal(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private String joinNonBlank(String... values) {
        List<String> parts = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.isBlank() && !parts.contains(value.trim())) {
                parts.add(value.trim());
            }
        }
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private double haversineKm(
            double lat1,
            double lon1,
            double lat2,
            double lon2
    ) {
        double earthRadiusKm = 6371.0088;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2)
                * Math.sin(dLon / 2);

        return earthRadiusKm
                * 2
                * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private double roundDistance(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private String stripTrailingSlash(String value) {
        String result = value == null ? "" : value.trim();
        while (result.endsWith("/")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }

    private String hostFromHttpsUrl(String value) {
        String withoutScheme = value.replaceFirst("^https://", "");
        int slash = withoutScheme.indexOf('/');
        return slash >= 0 ? withoutScheme.substring(0, slash) : withoutScheme;
    }

    private String pathFromHttpsUrl(String baseUrl, String suffix) {
        String withoutScheme = baseUrl.replaceFirst("^https://", "");
        int slash = withoutScheme.indexOf('/');
        String basePath = slash >= 0 ? withoutScheme.substring(slash) : "";

        if (basePath.endsWith("/")) {
            basePath = basePath.substring(0, basePath.length() - 1);
        }

        return basePath + suffix;
    }

    private record GeoPoint(
            BigDecimal latitude,
            BigDecimal longitude,
            String displayName
    ) {
    }

    private record CachedResult(
            Instant createdAt,
            DestinationDiscoveryResponse response
    ) {
    }
}

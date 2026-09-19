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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class DestinationDiscoveryService {

    private static final Logger log = LoggerFactory.getLogger(DestinationDiscoveryService.class);
    private static final String ATTRIBUTION = "© OpenStreetMap contributors · Wikimedia Commons where credited";
    private static final Pattern FIRST_AMOUNT = Pattern.compile("(\\d+(?:\\.\\d{1,2})?)");

    private final RestClient nominatimClient;
    private final RestClient photonClient;
    private final RestClient overpassClient;
    private final String nominatimUrl;
    private final String photonUrl;
    private final List<String> overpassUrls;
    private final Duration cacheDuration;
    private final int maxResults;
    private final Map<String, CachedRawResult> cache = new ConcurrentHashMap<>();
    private final Map<String, DiscoveredPlace> detailsCache = new ConcurrentHashMap<>();

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
        return search(destination, radiusKm, categoryValue, null, null, null, null, "DISTANCE", 0, maxResults);
    }

    public DestinationDiscoveryResponse search(
            String destination,
            int radiusKm,
            String categoryValue,
            String itemTypeValue,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            String priceStatusValue,
            String sortValue,
            int page,
            int size
    ) {
        String cleanDestination = destination == null ? "" : destination.trim();
        validateRequest(cleanDestination, radiusKm, minPrice, maxPrice, page, size);

        DiscoveryCategory category = parseCategory(categoryValue);
        DiscoveryItemType itemType = parseItemType(itemTypeValue);
        PriceStatus requestedPriceStatus = parsePriceStatus(priceStatusValue);
        int safeSize = Math.min(size, 100);
        String cacheKey = cleanDestination.toLowerCase(Locale.ROOT)
                + "|" + radiusKm
                + "|" + (category == null ? "ALL" : category.name());

        CachedRawResult raw = cache.get(cacheKey);
        if (raw == null || raw.createdAt().plus(cacheDuration).isBefore(Instant.now())) {
            GeoPoint destinationPoint = geocodeWithFallback(cleanDestination);
            FetchResult fetchResult = fetchPlacesWithFallback(destinationPoint, radiusKm, category, cleanDestination);

            List<String> warnings = new ArrayList<>(fetchResult.warnings());
            warnings.add("Prices and opening hours can change. Confirm with the linked official or source page before travelling.");
            if (fetchResult.places().isEmpty()) {
                warnings.add("No source-backed places were returned. TripMate did not create placeholder attractions or prices.");
            }

            raw = new CachedRawResult(
                    Instant.now(),
                    cleanDestination,
                    destinationPoint,
                    fetchResult.places(),
                    List.copyOf(warnings),
                    List.of(destinationPoint.provider(), fetchResult.provider())
            );
            cache.put(cacheKey, raw);
            fetchResult.places().forEach(place -> detailsCache.put(place.externalId(), place));
        }

        List<DiscoveredPlace> filtered = raw.places().stream()
                .filter(place -> itemType == null || place.itemType() == itemType)
                .filter(place -> requestedPriceStatus == null || place.priceStatus() == requestedPriceStatus)
                .filter(place -> minPrice == null
                        || (place.estimatedCostPerPerson() != null
                        && place.estimatedCostPerPerson().compareTo(minPrice) >= 0))
                .filter(place -> maxPrice == null
                        || (place.estimatedCostPerPerson() != null
                        && place.estimatedCostPerPerson().compareTo(maxPrice) <= 0))
                .sorted(sortComparator(sortValue))
                .toList();

        int fromIndex = Math.min(page * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        int totalPages = filtered.isEmpty() ? 0 : (int) Math.ceil(filtered.size() / (double) safeSize);
        List<DiscoveredPlace> pageContent = filtered.subList(fromIndex, toIndex);

        return new DestinationDiscoveryResponse(
                raw.query(),
                raw.destinationPoint().displayName(),
                raw.destinationPoint().latitude(),
                raw.destinationPoint().longitude(),
                radiusKm,
                category == null ? "ALL" : category.name(),
                String.join(" + ", raw.providersUsed()),
                ATTRIBUTION,
                filtered.size(),
                pageContent,
                raw.providersUsed(),
                raw.warnings(),
                raw.createdAt(),
                page,
                safeSize,
                totalPages
        );
    }

    public DiscoveredPlace findByExternalId(String externalId) {
        DiscoveredPlace place = detailsCache.get(externalId);
        if (place == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Discovery item is not in the current cache. Search the destination again."
            );
        }
        return place;
    }

    private void validateRequest(String destination, int radiusKm, BigDecimal minPrice, BigDecimal maxPrice, int page, int size) {
        if (destination.length() < 2 || destination.length() > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination must be between 2 and 180 characters");
        }
        if (radiusKm < 1 || radiusKm > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Radius must be between 1 and 100 km");
        }
        if ((minPrice != null && minPrice.signum() < 0) || (maxPrice != null && maxPrice.signum() < 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Price filters cannot be negative");
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Minimum price cannot exceed maximum price");
        }
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page must be non-negative and size must be between 1 and 100");
        }
    }

    private Comparator<DiscoveredPlace> sortComparator(String value) {
        String sort = value == null ? "DISTANCE" : value.trim().toUpperCase(Locale.ROOT);
        return switch (sort) {
            case "PRICE_LOW" -> Comparator.comparing(
                    DiscoveredPlace::estimatedCostPerPerson,
                    Comparator.nullsLast(BigDecimal::compareTo)
            ).thenComparingDouble(DiscoveredPlace::distanceKm);
            case "PRICE_HIGH" -> Comparator.comparing(
                    DiscoveredPlace::estimatedCostPerPerson,
                    Comparator.nullsLast(Comparator.reverseOrder())
            ).thenComparingDouble(DiscoveredPlace::distanceKm);
            case "VERIFIED" -> Comparator.comparingInt(this::priceConfidenceRank)
                    .thenComparing(Comparator.comparingDouble(DiscoveredPlace::confidenceScore).reversed())
                    .thenComparingDouble(DiscoveredPlace::distanceKm);
            case "NAME" -> Comparator.comparing(DiscoveredPlace::name, String.CASE_INSENSITIVE_ORDER);
            default -> Comparator.comparingDouble(DiscoveredPlace::distanceKm)
                    .thenComparing(DiscoveredPlace::name, String.CASE_INSENSITIVE_ORDER);
        };
    }

    private int priceConfidenceRank(DiscoveredPlace place) {
        return switch (place.priceStatus()) {
            case VERIFIED, FREE -> 0;
            case STARTING_FROM -> 1;
            case ESTIMATED -> 2;
            case UNKNOWN -> 3;
        };
    }

    private GeoPoint geocodeWithFallback(String destination) {
        boolean anyProviderAnswered = false;
        try {
            GeoPoint result = geocodeNominatim(destination);
            anyProviderAnswered = true;
            if (result != null) return result;
        } catch (RestClientException ex) {
            log.warn("Destination geocoder failed: provider=Nominatim error={}", ex.getClass().getSimpleName());
        }

        try {
            GeoPoint result = geocodePhoton(destination);
            anyProviderAnswered = true;
            if (result != null) return result;
        } catch (RestClientException ex) {
            log.warn("Destination geocoder failed: provider=Photon error={}", ex.getClass().getSimpleName());
        }

        if (anyProviderAnswered) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Indian destination could not be found. Try a city with its state, for example 'Kodaikanal, Tamil Nadu'."
            );
        }
        throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Destination lookup providers are temporarily unavailable. TripMate will not fabricate a location."
        );
    }

    private GeoPoint geocodeNominatim(String destination) {
        JsonNode response = nominatimClient.get()
                .uri(uriBuilder -> uriBuilder
                        .scheme("https")
                        .host(hostFromHttpsUrl(nominatimUrl))
                        .path(pathFromHttpsUrl(nominatimUrl, "/search"))
                        .queryParam("q", destination + ", India")
                        .queryParam("format", "jsonv2")
                        .queryParam("countrycodes", "in")
                        .queryParam("limit", 1)
                        .queryParam("addressdetails", 1)
                        .build())
                .retrieve()
                .body(JsonNode.class);

        if (response == null || !response.isArray() || response.isEmpty()) return null;
        JsonNode first = response.get(0);
        BigDecimal latitude = decimal(first.path("lat").asText(null));
        BigDecimal longitude = decimal(first.path("lon").asText(null));
        if (latitude == null || longitude == null) return null;
        return new GeoPoint(latitude, longitude, first.path("display_name").asText(destination), "Nominatim");
    }

    private GeoPoint geocodePhoton(String destination) {
        JsonNode response = photonClient.get()
                .uri(uriBuilder -> uriBuilder
                        .scheme("https")
                        .host(hostFromHttpsUrl(photonUrl))
                        .path(pathFromHttpsUrl(photonUrl, "/api"))
                        .queryParam("q", destination + ", India")
                        .queryParam("limit", 5)
                        .queryParam("lang", "en")
                        .build())
                .retrieve()
                .body(JsonNode.class);

        JsonNode features = response == null ? null : response.path("features");
        if (features == null || !features.isArray()) return null;

        for (JsonNode feature : features) {
            JsonNode properties = feature.path("properties");
            String countryCode = firstNonBlank(
                    properties.path("countrycode").asText(null),
                    properties.path("country_code").asText(null)
            );
            String country = properties.path("country").asText("");
            if (!("IN".equalsIgnoreCase(countryCode) || "India".equalsIgnoreCase(country))) continue;

            JsonNode coordinates = feature.path("geometry").path("coordinates");
            if (!coordinates.isArray() || coordinates.size() < 2) continue;
            BigDecimal longitude = decimal(coordinates.get(0).asText(null));
            BigDecimal latitude = decimal(coordinates.get(1).asText(null));
            if (latitude == null || longitude == null) continue;

            String displayName = joinNonBlank(
                    properties.path("name").asText(null),
                    properties.path("city").asText(null),
                    properties.path("state").asText(null),
                    properties.path("country").asText(null)
            );
            return new GeoPoint(latitude, longitude, displayName == null ? destination : displayName, "Photon");
        }
        return null;
    }

    private FetchResult fetchPlacesWithFallback(GeoPoint center, int radiusKm, DiscoveryCategory category, String destination) {
        String query = buildOverpassQuery(
                center.latitude().doubleValue(),
                center.longitude().doubleValue(),
                radiusKm * 1000,
                category
        );
        String encodedBody = "data=" + URLEncoder.encode(query, StandardCharsets.UTF_8);
        List<String> warnings = new ArrayList<>();

        for (int index = 0; index < overpassUrls.size(); index++) {
            String endpoint = overpassUrls.get(index);
            try {
                JsonNode response = overpassClient.post()
                        .uri(endpoint)
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(encodedBody)
                        .retrieve()
                        .body(JsonNode.class);
                List<DiscoveredPlace> places = mapOverpassPlaces(response, center, radiusKm, category, destination);
                if (index > 0) warnings.add("The primary map provider was unavailable; a configured OpenStreetMap fallback was used.");
                return new FetchResult(places, List.copyOf(warnings), "OpenStreetMap");
            } catch (RestClientException ex) {
                log.warn("Overpass provider failed: providerIndex={} error={}", index + 1, ex.getClass().getSimpleName());
            }
        }

        warnings.add("OpenStreetMap discovery providers are temporarily unavailable.");
        return new FetchResult(List.of(), List.copyOf(warnings), "OpenStreetMap unavailable");
    }

    private List<DiscoveredPlace> mapOverpassPlaces(
            JsonNode response,
            GeoPoint center,
            int radiusKm,
            DiscoveryCategory category,
            String destination
    ) {
        JsonNode elements = response == null ? null : response.path("elements");
        if (elements == null || !elements.isArray()) return List.of();

        Map<String, DiscoveredPlace> deduplicated = new LinkedHashMap<>();
        Instant checkedAt = Instant.now();

        for (JsonNode element : elements) {
            JsonNode tags = element.path("tags");
            if (!tags.isObject()) continue;
            String name = firstNonBlank(tags.path("name").asText(null), tags.path("name:en").asText(null));
            if (name == null) continue;

            BigDecimal lat = decimal(element.path("lat").asText(null));
            BigDecimal lon = decimal(element.path("lon").asText(null));
            if (lat == null || lon == null) {
                lat = decimal(element.path("center").path("lat").asText(null));
                lon = decimal(element.path("center").path("lon").asText(null));
            }
            if (lat == null || lon == null) continue;

            double distanceKm = haversineKm(
                    center.latitude().doubleValue(), center.longitude().doubleValue(), lat.doubleValue(), lon.doubleValue()
            );
            if (distanceKm > radiusKm + 0.2) continue;

            DiscoveryCategory mappedCategory = classify(tags, name);
            if (category != null && mappedCategory != category) continue;

            String type = element.path("type").asText("node");
            String id = element.path("id").asText();
            String externalId = "osm:" + type + ":" + id;
            String sourceUrl = "https://www.openstreetmap.org/" + type + "/" + id;
            ImageMetadata image = resolveImage(tags);
            PriceMetadata price = resolvePrice(tags, sourceUrl, checkedAt);
            String website = firstNonBlank(tags.path("website").asText(null), tags.path("contact:website").asText(null));
            String description = firstNonBlank(tags.path("description").asText(null), tags.path("description:en").asText(null));
            String address = buildAddress(tags, destination);
            DiscoveryItemType itemType = classifyItemType(tags, mappedCategory);
            String activityType = deduceActivityType(mappedCategory, name, tags);
            double confidence = confidenceScore(tags, website, image.url(), price.status());

            DiscoveredPlace place = new DiscoveredPlace(
                    externalId,
                    name,
                    mappedCategory,
                    lat.setScale(6, RoundingMode.HALF_UP),
                    lon.setScale(6, RoundingMode.HALF_UP),
                    roundDistance(distanceKm),
                    suggestedVisitMinutes(mappedCategory),
                    description,
                    image.url(),
                    emptyToNull(tags.path("opening_hours").asText(null)),
                    website,
                    toSavedPlaceCategory(mappedCategory),
                    price.amount(),
                    activityType,
                    itemType,
                    address,
                    googleMapsUrl(lat, lon),
                    price.status(),
                    price.type(),
                    "INR",
                    price.options(),
                    "OpenStreetMap",
                    sourceUrl,
                    checkedAt,
                    confidence,
                    image.source(),
                    image.attribution(),
                    image.license(),
                    image.exact(),
                    emptyToNull(tags.path("seasonal").asText(null)),
                    firstNonBlank(tags.path("safety:description").asText(null), tags.path("access:conditional").asText(null))
            );

            String dedupeKey = normalizeKey(name)
                    + "|" + lat.setScale(3, RoundingMode.HALF_UP)
                    + "|" + lon.setScale(3, RoundingMode.HALF_UP);
            deduplicated.putIfAbsent(dedupeKey, place);
        }

        return deduplicated.values().stream()
                .sorted(Comparator.comparingDouble(DiscoveredPlace::distanceKm)
                        .thenComparing(DiscoveredPlace::name, String.CASE_INSENSITIVE_ORDER))
                .limit(maxResults)
                .toList();
    }

    List<DiscoveredPlace> mapOverpassPlacesForTest(
            JsonNode response,
            BigDecimal latitude,
            BigDecimal longitude,
            int radiusKm,
            DiscoveryCategory category,
            String destination
    ) {
        return mapOverpassPlaces(
                response,
                new GeoPoint(latitude, longitude, destination + ", India", "Test geocoder"),
                radiusKm,
                category,
                destination
        );
    }

    String buildOverpassQuery(double lat, double lon, int radiusMeters, DiscoveryCategory category) {
        String around = "(around:" + radiusMeters + "," + lat + "," + lon + ")";
        List<String> selectors = new ArrayList<>();

        if (category == DiscoveryCategory.FOOD) {
            selectors.add("nwr" + around + "[\"amenity\"~\"restaurant|cafe|fast_food|food_court\"];");
        } else if (category == DiscoveryCategory.SHOPPING) {
            selectors.add("nwr" + around + "[\"amenity\"=\"marketplace\"];");
            selectors.add("nwr" + around + "[\"shop\"~\"mall|gift|art|craft|souvenir\"];");
        } else if (category == DiscoveryCategory.STAY) {
            selectors.add("nwr" + around + "[\"tourism\"~\"hotel|guest_house|hostel|motel|camp_site|apartment|alpine_hut\"];");
        } else if (category == DiscoveryCategory.ADVENTURE) {
            selectors.add("nwr" + around + "[\"tourism\"=\"adventure_park\"];");
            selectors.add("nwr" + around + "[\"leisure\"~\"water_park|theme_park|adventure_park\"];");
            selectors.add("nwr" + around + "[\"sport\"~\"climbing|surfing|scuba_diving|canoe|kayak|rafting|paragliding|horse_racing\"];");
        } else if (category == DiscoveryCategory.EVENT) {
            selectors.add("nwr" + around + "[\"event\"];");
            selectors.add("nwr" + around + "[\"amenity\"=\"events_venue\"];");
        } else {
            selectors.add("nwr" + around + "[\"tourism\"];");
            selectors.add("nwr" + around + "[\"historic\"];");
            selectors.add("nwr" + around + "[\"natural\"~\"waterfall|peak|beach|cave_entrance|spring|water\"];");
            selectors.add("nwr" + around + "[\"water\"~\"lake|reservoir\"];");
            selectors.add("nwr" + around + "[\"leisure\"~\"park|garden|nature_reserve|water_park|theme_park|adventure_park\"];");
            selectors.add("nwr" + around + "[\"amenity\"=\"place_of_worship\"];");
            selectors.add("nwr" + around + "[\"amenity\"~\"restaurant|cafe|food_court|marketplace\"];");
            selectors.add("nwr" + around + "[\"shop\"~\"mall|gift|art|craft|souvenir\"];");
            selectors.add("nwr" + around + "[\"sport\"~\"climbing|surfing|scuba_diving|canoe|kayak|rafting|paragliding|horse_racing\"];");
            selectors.add("nwr" + around + "[\"event\"];");
            selectors.add("nwr" + around + "[\"amenity\"=\"events_venue\"];");
            selectors.add("nwr" + around + "[\"office\"~\"travel_agent|tourism\"];");
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
        String sport = tags.path("sport").asText("");
        String event = tags.path("event").asText("");
        String lowerName = name.toLowerCase(Locale.ROOT);

        if (!event.isBlank() || "events_venue".equals(amenity)) return DiscoveryCategory.EVENT;
        if (tourism.matches("hotel|guest_house|hostel|motel|camp_site|apartment|alpine_hut")) return DiscoveryCategory.STAY;
        if ("waterfall".equals(natural) || lowerName.contains("waterfall") || lowerName.contains("falls")) return DiscoveryCategory.WATERFALL;
        if ("beach".equals(natural) || lowerName.contains(" beach")) return DiscoveryCategory.BEACH;
        if ("lake".equals(water) || "reservoir".equals(water) || lowerName.contains(" lake")) return DiscoveryCategory.LAKE;
        if ("viewpoint".equals(tourism) || lowerName.contains("view point") || lowerName.contains("viewpoint")) return DiscoveryCategory.VIEWPOINT;
        if ("museum".equals(tourism) || "museum".equals(amenity)) return DiscoveryCategory.MUSEUM;
        if (!historic.isBlank()) return DiscoveryCategory.HISTORICAL;
        if ("place_of_worship".equals(amenity)) {
            if ("christian".equals(religion) || lowerName.matches(".*(church|cathedral|chapel).*$")) return DiscoveryCategory.CHURCH;
            return DiscoveryCategory.TEMPLE;
        }
        if ("park".equals(leisure) || "garden".equals(leisure)) return DiscoveryCategory.PARK;
        if ("nature_reserve".equals(leisure)) return DiscoveryCategory.WILDLIFE;
        if ("peak".equals(natural) || "cave_entrance".equals(natural) || "spring".equals(natural) || "water".equals(natural)) return DiscoveryCategory.NATURE;
        if (leisure.matches("water_park|theme_park")) return DiscoveryCategory.ENTERTAINMENT;
        if ("adventure_park".equals(tourism) || "adventure_park".equals(leisure) || !sport.isBlank()) return DiscoveryCategory.ADVENTURE;
        if ("marketplace".equals(amenity) || !shop.isBlank()) return DiscoveryCategory.SHOPPING;
        if (amenity.matches("restaurant|cafe|fast_food|food_court")) return DiscoveryCategory.FOOD;
        return DiscoveryCategory.ATTRACTION;
    }

    PlaceCategory toSavedPlaceCategory(DiscoveryCategory category) {
        return switch (category) {
            case FOOD -> PlaceCategory.RESTAURANT;
            case SHOPPING -> PlaceCategory.SHOPPING;
            case STAY -> PlaceCategory.HOTEL;
            case ADVENTURE, ENTERTAINMENT, EVENT -> PlaceCategory.ACTIVITY;
            default -> PlaceCategory.ATTRACTION;
        };
    }

    int suggestedVisitMinutes(DiscoveryCategory category) {
        return switch (category) {
            case MUSEUM, HISTORICAL, ADVENTURE, ENTERTAINMENT, EVENT -> 120;
            case PARK, NATURE, WILDLIFE, WATERFALL, LAKE, BEACH -> 90;
            case FOOD -> 75;
            case SHOPPING -> 90;
            case STAY -> 60;
            default -> 60;
        };
    }

    List<String> configuredOverpassUrls() {
        return overpassUrls;
    }

    private DiscoveryItemType classifyItemType(JsonNode tags, DiscoveryCategory category) {
        if (category == DiscoveryCategory.FOOD) return DiscoveryItemType.FOOD;
        if (category == DiscoveryCategory.STAY) return DiscoveryItemType.STAY;
        if (category == DiscoveryCategory.EVENT) return DiscoveryItemType.EVENT;
        if (category == DiscoveryCategory.ADVENTURE || category == DiscoveryCategory.ENTERTAINMENT
                || !tags.path("sport").asText("").isBlank()) return DiscoveryItemType.ACTIVITY;
        if (tags.path("office").asText("").matches("travel_agent|tourism")) return DiscoveryItemType.TOUR_SERVICE;
        return DiscoveryItemType.PLACE;
    }

    private PriceMetadata resolvePrice(JsonNode tags, String sourceUrl, Instant checkedAt) {
        String fee = tags.path("fee").asText("").trim();
        String charge = firstNonBlank(tags.path("charge").asText(null), tags.path("fee:amount").asText(null));

        if ("no".equalsIgnoreCase(fee) || "free".equalsIgnoreCase(fee)) {
            DiscoveryPriceOption option = new DiscoveryPriceOption(
                    "Entry", BigDecimal.ZERO.setScale(2), null, PriceType.PER_PERSON, "INR", sourceUrl, checkedAt
            );
            return new PriceMetadata(BigDecimal.ZERO.setScale(2), PriceStatus.FREE, PriceType.PER_PERSON, List.of(option));
        }

        BigDecimal amount = firstAmount(charge);
        if (amount != null) {
            PriceType priceType = priceTypeFromText(charge);
            DiscoveryPriceOption option = new DiscoveryPriceOption(
                    "Source-listed price", amount, null, priceType, "INR", sourceUrl, checkedAt
            );
            return new PriceMetadata(amount, PriceStatus.ESTIMATED, priceType, List.of(option));
        }
        return new PriceMetadata(null, PriceStatus.UNKNOWN, PriceType.UNKNOWN, List.of());
    }

    private BigDecimal firstAmount(String value) {
        if (value == null || value.isBlank()) return null;
        Matcher matcher = FIRST_AMOUNT.matcher(value.replace(",", ""));
        if (!matcher.find()) return null;
        try {
            return new BigDecimal(matcher.group(1)).setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private PriceType priceTypeFromText(String text) {
        String value = text == null ? "" : text.toLowerCase(Locale.ROOT);
        if (value.contains("vehicle") || value.contains("car")) return PriceType.PER_VEHICLE;
        if (value.contains("night") || value.contains("room")) return PriceType.PER_NIGHT;
        if (value.contains("activity") || value.contains("ride")) return PriceType.PER_ACTIVITY;
        if (value.contains("person") || value.contains("adult") || value.contains("child")) return PriceType.PER_PERSON;
        return PriceType.UNKNOWN;
    }

    private ImageMetadata resolveImage(JsonNode tags) {
        String image = emptyToNull(tags.path("image").asText(null));
        if (image != null && (image.startsWith("https://") || image.startsWith("http://"))) {
            return new ImageMetadata(image, "OpenStreetMap image tag", "See linked source", "See source", true);
        }
        String commons = emptyToNull(tags.path("wikimedia_commons").asText(null));
        if (commons != null && commons.toLowerCase(Locale.ROOT).startsWith("file:")) {
            String fileName = commons.substring(5).trim();
            String url = "https://commons.wikimedia.org/wiki/Special:FilePath/"
                    + URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
            return new ImageMetadata(url, "Wikimedia Commons", commons, "See Wikimedia Commons file page", true);
        }
        return new ImageMetadata(null, null, null, null, false);
    }

    private String buildAddress(JsonNode tags, String destination) {
        String address = joinNonBlank(
                tags.path("addr:housename").asText(null),
                tags.path("addr:housenumber").asText(null),
                tags.path("addr:street").asText(null),
                tags.path("addr:suburb").asText(null),
                tags.path("addr:city").asText(null),
                tags.path("addr:district").asText(null),
                tags.path("addr:state").asText(null),
                tags.path("addr:postcode").asText(null)
        );
        return address == null ? destination : address;
    }

    private String deduceActivityType(DiscoveryCategory category, String name, JsonNode tags) {
        String sport = emptyToNull(tags.path("sport").asText(null));
        if (sport != null) return formatTag(sport);
        String lowerName = name.toLowerCase(Locale.ROOT);
        if (lowerName.contains("rafting")) return "White Water Rafting";
        if (lowerName.contains("bungee")) return "Bungee Jumping";
        if (lowerName.contains("zipline")) return "Ziplining";
        if (lowerName.contains("kayak")) return "Kayaking";
        if (lowerName.contains("boat")) return "Boating";
        if (category == DiscoveryCategory.ADVENTURE) return "Adventure Activity";
        return null;
    }

    private double confidenceScore(JsonNode tags, String website, String imageUrl, PriceStatus priceStatus) {
        double score = 0.60;
        if (website != null) score += 0.10;
        if (imageUrl != null) score += 0.10;
        if (!tags.path("opening_hours").asText("").isBlank()) score += 0.05;
        if (!tags.path("description").asText("").isBlank()) score += 0.05;
        if (priceStatus != PriceStatus.UNKNOWN) score += 0.05;
        if (!tags.path("wikidata").asText("").isBlank()) score += 0.05;
        return Math.min(1.0, score);
    }

    private String googleMapsUrl(BigDecimal lat, BigDecimal lon) {
        return "https://www.google.com/maps/dir/?api=1&destination=" + lat.toPlainString() + "," + lon.toPlainString();
    }

    private RestClient buildClient(String userAgent, int connectTimeoutMs, int readTimeoutMs) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
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
                if (!value.isBlank() && value.startsWith("https://")) urls.add(value);
            }
        }
        if (urls.isEmpty()) urls.add("https://overpass-api.de/api/interpreter");
        return List.copyOf(urls);
    }

    private DiscoveryCategory parseCategory(String value) {
        if (value == null || value.isBlank() || "ALL".equalsIgnoreCase(value)) return null;
        try {
            return DiscoveryCategory.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported discovery category");
        }
    }

    private DiscoveryItemType parseItemType(String value) {
        if (value == null || value.isBlank() || "ALL".equalsIgnoreCase(value)) return null;
        try {
            return DiscoveryItemType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported discovery item type");
        }
    }

    private PriceStatus parsePriceStatus(String value) {
        if (value == null || value.isBlank() || "ALL".equalsIgnoreCase(value)) return null;
        try {
            return PriceStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported price status");
        }
    }

    private String normalizeKey(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private String formatTag(String value) {
        String[] parts = value.replace('_', ' ').split("\\s+");
        List<String> formatted = new ArrayList<>();
        for (String part : parts) {
            if (!part.isBlank()) formatted.add(part.substring(0, 1).toUpperCase(Locale.ROOT) + part.substring(1));
        }
        return String.join(" ", formatted);
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
        for (String value : values) if (value != null && !value.isBlank()) return value.trim();
        return null;
    }

    private String joinNonBlank(String... values) {
        List<String> parts = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.isBlank() && !parts.contains(value.trim())) parts.add(value.trim());
        }
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusKm = 6371.0088;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private double roundDistance(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private String stripTrailingSlash(String value) {
        String result = value == null ? "" : value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
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
        if (basePath.endsWith("/")) basePath = basePath.substring(0, basePath.length() - 1);
        return basePath + suffix;
    }

    private record GeoPoint(BigDecimal latitude, BigDecimal longitude, String displayName, String provider) {
    }

    private record FetchResult(List<DiscoveredPlace> places, List<String> warnings, String provider) {
    }

    private record CachedRawResult(
            Instant createdAt,
            String query,
            GeoPoint destinationPoint,
            List<DiscoveredPlace> places,
            List<String> warnings,
            List<String> providersUsed
    ) {
    }

    private record PriceMetadata(
            BigDecimal amount,
            PriceStatus status,
            PriceType type,
            List<DiscoveryPriceOption> options
    ) {
    }

    private record ImageMetadata(String url, String source, String attribution, String license, boolean exact) {
    }
}

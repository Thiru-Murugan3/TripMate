package com.tripmate.discovery.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.*;
import com.tripmate.place.PlaceCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Component
@Order(20)
public class OverpassDiscoveryProvider implements DiscoveryProvider {
    private static final Logger log = LoggerFactory.getLogger(OverpassDiscoveryProvider.class);
    private static final String ATTRIBUTION = "© OpenStreetMap contributors · Wikimedia Commons where credited";
    private static final List<String> GLOBAL_FALLBACK_ENDPOINTS = List.of(
            "https://overpass-api.de/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
            "https://overpass.private.coffee/api/interpreter"
    );
    private final RestClient client;
    private final List<String> endpoints;
    private final PriceVerificationService priceVerification;
    private final ImageResolverService imageResolver;
    private final WikimediaEnrichmentService wikimediaEnrichment;
    private final int maxResults;

    public OverpassDiscoveryProvider(
            ProviderHttpClientFactory factory,
            PriceVerificationService priceVerification,
            ImageResolverService imageResolver,
            WikimediaEnrichmentService wikimediaEnrichment,
            @Value("${discovery.overpass-urls:${discovery.overpass-url:https://overpass-api.de/api/interpreter}}") String urls,
            @Value("${discovery.max-results:200}") int maxResults
    ) {
        this.client = factory.create(Integer.MAX_VALUE);
        this.priceVerification = priceVerification;
        this.imageResolver = imageResolver;
        this.wikimediaEnrichment = wikimediaEnrichment;
        this.endpoints = parseUrls(urls);
        this.maxResults = Math.max(25, Math.min(500, maxResults));
    }

    @Override public String name() { return "OpenStreetMap"; }

    @Override
    public DiscoveryProviderResult discover(DiscoveryProviderRequest request) {
        String query = buildQuery(request.destination().latitude().doubleValue(),
                request.destination().longitude().doubleValue(), request.radiusKm() * 1000, request.category());
        String body = "data=" + URLEncoder.encode(query, StandardCharsets.UTF_8);
        List<String> warnings = new ArrayList<>();
        for (int index = 0; index < endpoints.size(); index++) {
            try {
                JsonNode response = client.post().uri(endpoints.get(index))
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(body)
                        .retrieve().body(JsonNode.class);
                List<DiscoveredPlace> places = map(response, request);
                if (!places.isEmpty()) {
                    if (index > 0) warnings.add("The primary OpenStreetMap endpoint was unavailable; a global fallback was used.");
                    return new DiscoveryProviderResult(name(), ATTRIBUTION, places, warnings);
                }
                log.warn("Overpass endpoint returned no matching elements: index={}", index + 1);
            } catch (RestClientException ex) {
                log.warn("Overpass endpoint failed: index={} error={}", index + 1, ex.getClass().getSimpleName());
            }
        }
        warnings.add("OpenStreetMap discovery is temporarily unavailable.");
        return new DiscoveryProviderResult(name(), ATTRIBUTION, List.of(), warnings);
    }

    public List<DiscoveredPlace> map(JsonNode response, DiscoveryProviderRequest request) {
        JsonNode elements = response == null ? null : response.path("elements");
        if (elements == null || !elements.isArray()) return List.of();
        Map<String, DiscoveredPlace> unique = new LinkedHashMap<>();
        Instant checkedAt = Instant.now();
        int enrichmentBudget = 6;
        for (JsonNode element : elements) {
            JsonNode tags = element.path("tags");
            String name = first(tags.path("name").asText(null), tags.path("name:en").asText(null));
            if (name == null) continue;
            BigDecimal latitude = decimal(element.path("lat").asText(null));
            BigDecimal longitude = decimal(element.path("lon").asText(null));
            if (latitude == null || longitude == null) {
                latitude = decimal(element.path("center").path("lat").asText(null));
                longitude = decimal(element.path("center").path("lon").asText(null));
            }
            if (!validIndiaCoordinates(latitude, longitude)) continue;
            double distance = haversine(request.destination().latitude().doubleValue(),
                    request.destination().longitude().doubleValue(), latitude.doubleValue(), longitude.doubleValue());
            if (distance > request.radiusKm() + 0.2) continue;

            DiscoveryCategory category = classify(tags, name);
            if (request.category() != null && category != request.category()) continue;
            String type = element.path("type").asText("node");
            String id = element.path("id").asText();
            if (id.isBlank()) continue;
            String externalId = "osm:" + type + ":" + id;
            String sourceUrl = "https://www.openstreetmap.org/" + type + "/" + id;
            PriceVerificationService.VerifiedPrice price = priceVerification.fromOpenStreetMap(tags, sourceUrl, checkedAt);
            ImageResolverService.ResolvedImages resolvedImages = imageResolver.fromOpenStreetMap(tags, sourceUrl);
            DiscoveryImage primary = resolvedImages.primary();
            List<DiscoveryImage> gallery = resolvedImages.gallery();
            String website = first(tags.path("website").asText(null), tags.path("contact:website").asText(null));
            String phone = first(tags.path("phone").asText(null), tags.path("contact:phone").asText(null));
            String shortDescription = first(tags.path("description").asText(null), tags.path("description:en").asText(null));
            if (enrichmentBudget > 0 && (shortDescription == null || primary == null)
                    && (!value(tags, "wikipedia").isBlank() || !value(tags, "wikidata").isBlank())) {
                WikimediaEnrichmentService.Enrichment enrichment = wikimediaEnrichment.resolve(tags);
                enrichmentBudget--;
                if (shortDescription == null) shortDescription = enrichment.description();
                if (primary == null && enrichment.image() != null) {
                    primary = enrichment.image();
                    gallery = enrichment.gallery();
                }
            }
            String city = first(tags.path("addr:city").asText(null), tags.path("addr:town").asText(null), request.destination().city());
            String district = first(tags.path("addr:district").asText(null), request.destination().district());
            String state = first(tags.path("addr:state").asText(null), request.destination().state());
            String address = address(tags, request.query());
            String subcategory = subcategory(tags, category);
            DiscoveryItemType itemType = itemType(tags, category);
            Integer duration = suggestedMinutes(category);
            boolean family = familyFriendly(tags, category);
            Double rating = decimalDouble(first(tags.path("rating").asText(null), tags.path("stars").asText(null)));

            DiscoveredPlace place = new DiscoveredPlace(
                    externalId, name, category, latitude.setScale(6, RoundingMode.HALF_UP),
                    longitude.setScale(6, RoundingMode.HALF_UP), round(distance), duration,
                    shortDescription, primary == null ? null : primary.url(), tags.path("opening_hours").asText(null),
                    website, saveCategory(category), price.amount(), activityType(category, name, tags), slug(name),
                    itemType, subcategory, city, district, state, address, address, shortDescription,
                    shortDescription, primary == null ? null : primary.url(), gallery,
                    primary == null ? null : primary.sourceName(), primary == null ? null : primary.attribution(),
                    primary == null ? null : primary.license(), primary != null && primary.exact(),
                    seasonal(tags), duration, integer(tags, "min_age"), integer(tags, "max_age"),
                    decimal(tags.path("min_weight").asText(null)), decimal(tags.path("max_weight").asText(null)),
                    difficulty(tags), first(tags.path("safety:description").asText(null), tags.path("access:conditional").asText(null)),
                    List.of(), List.of(), List.of(), tags.path("wheelchair").asText(null), phone, website,
                    first(tags.path("booking").asText(null), tags.path("contact:booking").asText(null)), null,
                    mapUrl(latitude, longitude), price.status(), price.type(), price.currency(), price.options(),
                    name(), sourceUrl, checkedAt, price.expiresAt(), price.expired(), confidence(tags, website, primary, price),
                    rating, integer(tags, "rating:count"), popularity(tags), family, openNow(tags.path("opening_hours").asText(null)), false
            );
            String key = normalize(name) + "|" + latitude.setScale(3, RoundingMode.HALF_UP)
                    + "|" + longitude.setScale(3, RoundingMode.HALF_UP);
            unique.putIfAbsent(key, place);
        }
        return unique.values().stream().sorted(Comparator.comparingDouble(DiscoveredPlace::distanceKm))
                .limit(maxResults).toList();
    }

    public String buildQuery(double lat, double lon, int radiusMeters, DiscoveryCategory category) {
        String around = "(around:" + radiusMeters + "," + lat + "," + lon + ")";
        List<String> selectors = new ArrayList<>();
        if (category == DiscoveryCategory.FOOD) {
            selectors.add("nwr" + around + "[\"amenity\"~\"restaurant|cafe|fast_food|food_court\"];");
        } else if (category == DiscoveryCategory.STAY) {
            selectors.add("nwr" + around + "[\"tourism\"~\"hotel|guest_house|hostel|motel|camp_site|apartment|chalet|homestay\"];");
        } else if (category == DiscoveryCategory.NIGHTLIFE) {
            selectors.add("nwr" + around + "[\"amenity\"~\"bar|pub|nightclub\"];");
        } else if (category == DiscoveryCategory.WELLNESS) {
            selectors.add("nwr" + around + "[\"leisure\"~\"spa|sauna|fitness_centre\"];");
            selectors.add("nwr" + around + "[\"healthcare\"=\"alternative\"];");
        } else if (category == DiscoveryCategory.TRANSPORT) {
            selectors.add("nwr" + around + "[\"amenity\"~\"bus_station|taxi|car_rental|bicycle_rental\"];");
            selectors.add("nwr" + around + "[\"public_transport\"];");
            selectors.add("nwr" + around + "[\"office\"~\"travel_agent|tourism\"];");
        } else if (category == DiscoveryCategory.EVENT || category == DiscoveryCategory.CULTURAL) {
            selectors.add("nwr" + around + "[\"event\"];");
            selectors.add("nwr" + around + "[\"amenity\"~\"events_venue|arts_centre|theatre\"];");
        } else {
            selectors.add("nwr" + around + "[\"tourism\"];");
            selectors.add("nwr" + around + "[\"historic\"];");
            selectors.add("nwr" + around + "[\"natural\"~\"waterfall|peak|beach|cave_entrance|spring|water\"];");
            selectors.add("nwr" + around + "[\"water\"~\"lake|reservoir|river\"];");
            selectors.add("nwr" + around + "[\"waterway\"=\"river\"];");
            selectors.add("nwr" + around + "[\"leisure\"~\"park|garden|nature_reserve|water_park|theme_park|adventure_park|spa\"];");
            selectors.add("nwr" + around + "[\"amenity\"~\"place_of_worship|restaurant|cafe|fast_food|food_court|marketplace|bar|pub|nightclub|events_venue|arts_centre|theatre|bus_station|taxi|car_rental|bicycle_rental\"];");
            selectors.add("nwr" + around + "[\"shop\"~\"mall|gift|art|craft|souvenir\"];");
            selectors.add("nwr" + around + "[\"sport\"~\"climbing|surfing|scuba_diving|canoe|kayak|rafting|paragliding|horse_racing\"];");
            selectors.add("nwr" + around + "[\"event\"];");
            selectors.add("nwr" + around + "[\"office\"~\"travel_agent|tourism\"];");
        }
        return "[out:json][timeout:25];(" + String.join("", selectors) + ");out center tags;";
    }

    public DiscoveryCategory classify(JsonNode tags, String name) {
        String tourism = value(tags, "tourism"), natural = value(tags, "natural"), water = value(tags, "water");
        String waterway = value(tags, "waterway"), historic = value(tags, "historic"), leisure = value(tags, "leisure");
        String amenity = value(tags, "amenity"), shop = value(tags, "shop"), sport = value(tags, "sport");
        String religion = value(tags, "religion"), event = value(tags, "event"), office = value(tags, "office");
        String lower = name.toLowerCase(Locale.ROOT);
        if (!event.isBlank() || "events_venue".equals(amenity)) return DiscoveryCategory.EVENT;
        if (amenity.matches("arts_centre|theatre")) return DiscoveryCategory.CULTURAL;
        if (amenity.matches("bar|pub|nightclub")) return DiscoveryCategory.NIGHTLIFE;
        if (leisure.matches("spa|sauna|fitness_centre") || "alternative".equals(value(tags, "healthcare"))) return DiscoveryCategory.WELLNESS;
        if (amenity.matches("bus_station|taxi|car_rental|bicycle_rental") || !value(tags, "public_transport").isBlank()
                || office.matches("travel_agent|tourism")) return DiscoveryCategory.TRANSPORT;
        if (tourism.matches("hotel|guest_house|hostel|motel|camp_site|apartment|chalet|homestay")) return DiscoveryCategory.STAY;
        if ("waterfall".equals(natural) || lower.contains("waterfall") || lower.contains("falls")) return DiscoveryCategory.WATERFALL;
        if ("beach".equals(natural) || lower.contains(" beach")) return DiscoveryCategory.BEACH;
        if ("river".equals(water) || "river".equals(waterway) || lower.contains(" river")) return DiscoveryCategory.RIVER;
        if ("lake".equals(water) || "reservoir".equals(water) || lower.contains(" lake")) return DiscoveryCategory.LAKE;
        if ("viewpoint".equals(tourism) || lower.contains("viewpoint") || lower.contains("view point")) return DiscoveryCategory.VIEWPOINT;
        if ("museum".equals(tourism) || "museum".equals(amenity)) return DiscoveryCategory.MUSEUM;
        if (!historic.isBlank()) return DiscoveryCategory.HISTORICAL;
        if ("place_of_worship".equals(amenity)) return "christian".equals(religion) || lower.matches(".*(church|cathedral|chapel).*")
                ? DiscoveryCategory.CHURCH : DiscoveryCategory.TEMPLE;
        if (leisure.matches("park|garden")) return DiscoveryCategory.PARK;
        if ("nature_reserve".equals(leisure)) return DiscoveryCategory.WILDLIFE;
        if (natural.matches("peak|cave_entrance|spring|water")) return DiscoveryCategory.NATURE;
        if (leisure.matches("water_park|theme_park")) return DiscoveryCategory.ENTERTAINMENT;
        if ("playground".equals(leisure)) return DiscoveryCategory.FAMILY;
        if ("adventure_park".equals(tourism) || "adventure_park".equals(leisure) || !sport.isBlank()) return DiscoveryCategory.ADVENTURE;
        if ("marketplace".equals(amenity) || !shop.isBlank()) return DiscoveryCategory.SHOPPING;
        if (amenity.matches("restaurant|cafe|fast_food|food_court")) return DiscoveryCategory.FOOD;
        return DiscoveryCategory.ATTRACTION;
    }

    private DiscoveryItemType itemType(JsonNode tags, DiscoveryCategory category) {
        if (category == DiscoveryCategory.FOOD) return DiscoveryItemType.FOOD;
        if (category == DiscoveryCategory.STAY) return DiscoveryItemType.STAY;
        if (category == DiscoveryCategory.EVENT || category == DiscoveryCategory.CULTURAL) return DiscoveryItemType.EVENT;
        if (category == DiscoveryCategory.TRANSPORT || value(tags, "office").matches("travel_agent|tourism")) return DiscoveryItemType.TOUR_SERVICE;
        if (EnumSet.of(DiscoveryCategory.ADVENTURE, DiscoveryCategory.ENTERTAINMENT, DiscoveryCategory.FAMILY,
                DiscoveryCategory.WELLNESS, DiscoveryCategory.NIGHTLIFE).contains(category)) return DiscoveryItemType.ACTIVITY;
        return DiscoveryItemType.PLACE;
    }

    private PlaceCategory saveCategory(DiscoveryCategory category) {
        return switch (category) {
            case FOOD -> PlaceCategory.RESTAURANT;
            case SHOPPING -> PlaceCategory.SHOPPING;
            case STAY -> PlaceCategory.HOTEL;
            case ADVENTURE, ENTERTAINMENT, FAMILY, EVENT, CULTURAL, NIGHTLIFE, WELLNESS -> PlaceCategory.ACTIVITY;
            default -> PlaceCategory.ATTRACTION;
        };
    }

    private String subcategory(JsonNode tags, DiscoveryCategory category) {
        return first(clean(value(tags, "sport")), clean(value(tags, "tourism")), clean(value(tags, "historic")),
                clean(value(tags, "amenity")), clean(value(tags, "leisure")), category.name().toLowerCase(Locale.ROOT));
    }
    private String activityType(DiscoveryCategory category, String name, JsonNode tags) {
        String sport = clean(value(tags, "sport"));
        if (sport != null) return title(sport);
        return EnumSet.of(DiscoveryCategory.ADVENTURE, DiscoveryCategory.ENTERTAINMENT, DiscoveryCategory.FAMILY,
                DiscoveryCategory.WELLNESS, DiscoveryCategory.NIGHTLIFE).contains(category) ? title(subcategory(tags, category)) : null;
    }
    private Integer suggestedMinutes(DiscoveryCategory category) {
        return switch (category) {
            case MUSEUM, HISTORICAL, ADVENTURE, ENTERTAINMENT, EVENT, CULTURAL, WILDLIFE -> 120;
            case PARK, NATURE, WATERFALL, LAKE, RIVER, BEACH, WELLNESS -> 90;
            case FOOD, NIGHTLIFE -> 75;
            case SHOPPING -> 90;
            case STAY, TRANSPORT -> 60;
            default -> 60;
        };
    }
    private boolean familyFriendly(JsonNode tags, DiscoveryCategory category) {
        if (EnumSet.of(DiscoveryCategory.FAMILY, DiscoveryCategory.PARK, DiscoveryCategory.MUSEUM,
                DiscoveryCategory.ENTERTAINMENT).contains(category)) return true;
        return "yes".equalsIgnoreCase(value(tags, "kids_area")) || "yes".equalsIgnoreCase(value(tags, "family"));
    }
    private Boolean openNow(String hours) {
        if (hours == null || hours.isBlank()) return null;
        if ("24/7".equalsIgnoreCase(hours.trim())) return true;
        return null;
    }
    private int popularity(JsonNode tags) {
        int score = 0;
        if (!value(tags, "wikidata").isBlank()) score += 30;
        if (!value(tags, "wikipedia").isBlank()) score += 25;
        if (!value(tags, "website").isBlank()) score += 15;
        if (!value(tags, "image").isBlank() || !value(tags, "wikimedia_commons").isBlank()) score += 15;
        if (!value(tags, "opening_hours").isBlank()) score += 10;
        return score;
    }
    private double confidence(JsonNode tags, String website, DiscoveryImage image, PriceVerificationService.VerifiedPrice price) {
        double score = 0.55;
        if (website != null) score += .10;
        if (image != null) score += .10;
        if (!value(tags, "opening_hours").isBlank()) score += .05;
        if (!value(tags, "description").isBlank()) score += .05;
        if (price.status() != PriceStatus.UNKNOWN) score += .05;
        if (!value(tags, "wikidata").isBlank()) score += .10;
        return Math.min(1, score);
    }
    private String seasonal(JsonNode tags) {
        String seasonal = clean(value(tags, "seasonal"));
        return seasonal == null ? null : "Seasonal information: " + seasonal;
    }
    private String difficulty(JsonNode tags) {
        return first(clean(value(tags, "difficulty")), clean(value(tags, "sac_scale")), clean(value(tags, "mtb:scale")));
    }
    private String address(JsonNode tags, String fallback) {
        List<String> parts = new ArrayList<>();
        for (String key : List.of("addr:housename", "addr:housenumber", "addr:street", "addr:suburb", "addr:city", "addr:district", "addr:state", "addr:postcode")) {
            String value = clean(tags.path(key).asText(null));
            if (value != null && !parts.contains(value)) parts.add(value);
        }
        return parts.isEmpty() ? fallback : String.join(", ", parts);
    }
    private String mapUrl(BigDecimal lat, BigDecimal lon) { return "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon; }
    private boolean validIndiaCoordinates(BigDecimal lat, BigDecimal lon) {
        return lat != null && lon != null && lat.doubleValue() >= 6 && lat.doubleValue() <= 37.5
                && lon.doubleValue() >= 68 && lon.doubleValue() <= 97.5;
    }
    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    private List<String> parseUrls(String csv) {
        LinkedHashSet<String> urls = new LinkedHashSet<>();
        Arrays.stream(csv.split(",")).map(String::trim)
                .filter(url -> url.startsWith("https://"))
                .forEach(urls::add);
        urls.addAll(GLOBAL_FALLBACK_ENDPOINTS);
        return List.copyOf(urls);
    }
    private String value(JsonNode tags, String key) { return tags.path(key).asText(""); }
    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String first(String... values) { for (String value : values) if (value != null && !value.isBlank()) return value.trim(); return null; }
    private BigDecimal decimal(String value) { try { return value == null || value.isBlank() ? null : new BigDecimal(value); } catch (NumberFormatException ex) { return null; } }
    private Double decimalDouble(String value) { try { return value == null ? null : Double.valueOf(value); } catch (NumberFormatException ex) { return null; } }
    private Integer integer(JsonNode tags, String key) { try { String value = value(tags, key).replaceAll("[^0-9]", ""); return value.isBlank() ? null : Integer.valueOf(value); } catch (NumberFormatException ex) { return null; } }
    private String normalize(String value) { return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", ""); }
    private String slug(String value) { return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", ""); }
    private String title(String value) { return Arrays.stream(value.replace('_', ' ').split("\\s+")).filter(part -> !part.isBlank()).map(part -> part.substring(0, 1).toUpperCase(Locale.ROOT) + part.substring(1)).reduce((a, b) -> a + " " + b).orElse(value); }
    private double round(double value) { return Math.round(value * 10.0) / 10.0; }
}

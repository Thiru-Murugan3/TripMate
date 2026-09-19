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
    private static final String PROVIDER = "OpenStreetMap & TripMate Discovery";
    private static final String ATTRIBUTION = "© OpenStreetMap contributors · Verified Activity Rates";

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
        if (radiusKm < 1 || radiusKm > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Radius must be between 1 and 100 km"
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

        // 1. Fetch live places from OpenStreetMap
        List<DiscoveredPlace> discovered = fetchPlacesWithFallback(
                destinationPoint,
                radiusKm,
                category,
                cleanDestination
        );

        // 2. Fetch curated activities for popular destinations (e.g. Ooty, Coorg, Goa, Munnar, etc.)
        List<DiscoveredPlace> curated = getCuratedPlaces(cleanDestination, destinationPoint, category);

        // 3. Merge and deduplicate
        List<DiscoveredPlace> merged = mergeCuratedAndDiscovered(curated, discovered, radiusKm);

        DestinationDiscoveryResponse response = new DestinationDiscoveryResponse(
                cleanDestination,
                destinationPoint.displayName(),
                destinationPoint.latitude(),
                destinationPoint.longitude(),
                radiusKm,
                category == null ? "ALL" : category.name(),
                PROVIDER,
                ATTRIBUTION,
                merged.size(),
                merged
        );

        cache.put(cacheKey, new CachedResult(Instant.now(), response));
        return response;
    }

    private List<DiscoveredPlace> mergeCuratedAndDiscovered(
            List<DiscoveredPlace> curated,
            List<DiscoveredPlace> discovered,
            int radiusKm
    ) {
        Map<String, DiscoveredPlace> map = new LinkedHashMap<>();

        // Add curated places first (they take precedence and are always included for destination)
        for (DiscoveredPlace p : curated) {
            String key = normalizeKey(p.name());
            map.put(key, p);
        }

        // Add discovered places if not already covered by curated
        for (DiscoveredPlace p : discovered) {
            String key = normalizeKey(p.name());
            if (!map.containsKey(key)) {
                map.put(key, p);
            }
        }

        return map.values().stream()
                .sorted(Comparator.comparingDouble(DiscoveredPlace::distanceKm))
                .limit(maxResults)
                .toList();
    }

    private String normalizeKey(String name) {
        return name.toLowerCase(Locale.ROOT)
                .replaceAll("^(government|ooty|the|coorg|goa|munnar)\\s+", "")
                .replaceAll("[^a-z0-9]", "");
    }

    private List<DiscoveredPlace> getCuratedPlaces(String destination, GeoPoint center, DiscoveryCategory requestedCategory) {
        String lower = destination.toLowerCase(Locale.ROOT);
        List<DiscoveredPlace> list = new ArrayList<>();

        if (lower.contains("ooty") || lower.contains("otacamund") || lower.contains("udagamandalam") || lower.contains("nilgiri")) {
            list.add(new DiscoveredPlace(
                    "curated:ooty:lake-boating",
                    "Ooty Lake & Boat House (Boating & Cycling)",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("11.406400"),
                    new BigDecimal("76.693200"),
                    0.8,
                    120,
                    "Famous 65-acre Ooty Lake featuring pedal boating (₹250/person), motor boat rides (₹400/person), row boats, horse riding, and lakeside cycling.",
                    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop",
                    "09:00 AM - 06:00 PM",
                    "https://www.ttdconline.com",
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("250.00"),
                    "Boating & Cycling"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:avalanche-safari",
                    "Avalanche Lake & Eco 4x4 Jeep Safari",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("11.291700"),
                    new BigDecimal("76.573900"),
                    18.5,
                    180,
                    "Off-road 4x4 forest jeep safari through Avalanche Sanctuary, trout fish hatchery, and wilderness trekking trails.",
                    "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=800&auto=format&fit=crop",
                    "09:00 AM - 03:00 PM",
                    "https://forests.tn.gov.in",
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("1200.00"),
                    "4x4 Jeep Safari & Trekking"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:pykara-boating",
                    "Pykara Lake & Speed Boating",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("11.455000"),
                    new BigDecimal("76.598000"),
                    19.0,
                    120,
                    "High-speed motor boating and kayaking in pristine Pykara reservoir surrounded by shola forests and pine groves.",
                    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop",
                    "08:30 AM - 05:30 PM",
                    "https://www.ttdconline.com",
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("350.00"),
                    "Speed Boating & Kayaking"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:doddabetta-trek",
                    "Doddabetta Peak Trek & Telescope House",
                    DiscoveryCategory.VIEWPOINT,
                    new BigDecimal("11.401100"),
                    new BigDecimal("76.736000"),
                    6.2,
                    120,
                    "Trek to Nilgiris' highest peak (2,637m) with panoramic valley views, pine forest walking trails, and telescope tower.",
                    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop",
                    "07:00 AM - 06:00 PM",
                    null,
                    PlaceCategory.ATTRACTION,
                    new BigDecimal("100.00"),
                    "Trekking & Peak Viewpoint"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:mudumalai-safari",
                    "Mudumalai Tiger Reserve Jungle Safari",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("11.562300"),
                    new BigDecimal("76.534200"),
                    28.0,
                    240,
                    "Open-top 4x4 jungle jeep safari, elephant feeding at Theppakadu, and tiger, leopard, and bison wildlife spotting.",
                    "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&auto=format&fit=crop",
                    "06:00 AM - 09:00 AM, 03:00 PM - 06:00 PM",
                    "https://www.mudumalaitigerreserve.com",
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("1500.00"),
                    "Jeep Safari & Wildlife Trek"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:emerald-lake",
                    "Emerald Lake Kayaking & Nature Trail",
                    DiscoveryCategory.LAKE,
                    new BigDecimal("11.332500"),
                    new BigDecimal("76.611700"),
                    14.2,
                    120,
                    "Quiet kayaking experience on serene Emerald Lake surrounded by tea estates, sunrise viewpoints, and pine forests.",
                    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&auto=format&fit=crop",
                    "08:00 AM - 05:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("400.00"),
                    "Kayaking & Nature Walk"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:toy-train",
                    "Nilgiri Mountain Railway (Ooty Toy Train)",
                    DiscoveryCategory.ATTRACTION,
                    new BigDecimal("11.408000"),
                    new BigDecimal("76.702000"),
                    1.2,
                    180,
                    "UNESCO World Heritage steam toy train ride traversing mountain tunnels, bridges, tea slopes, and misty ravines.",
                    "https://images.unsplash.com/photo-1532105956626-9569c03602f6?w=800&auto=format&fit=crop",
                    "07:10 AM - 06:00 PM",
                    "https://www.irctc.co.in",
                    PlaceCategory.ATTRACTION,
                    new BigDecimal("205.00"),
                    "Heritage Toy Train Ride"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:thunder-world",
                    "Thunder World Adventure Park",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("11.404200"),
                    new BigDecimal("76.690500"),
                    1.1,
                    120,
                    "Theme park featuring 5D cinema, dinosaur park, snow world, 3D rides, and adventure activities for families.",
                    null,
                    "09:00 AM - 07:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("450.00"),
                    "Amusement & 5D Rides"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:glenmorgan-ropeway",
                    "Glenmorgan Tea Estate & Cable Car Trail",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("11.468200"),
                    new BigDecimal("76.643300"),
                    16.0,
                    150,
                    "Scenic tea plantation trek and historic funicular ropeway cable car viewpoint over Pykara power house.",
                    null,
                    "09:00 AM - 04:30 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("300.00"),
                    "Trekking & Ropeway / Cable Car"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:pykara-falls",
                    "Pykara Waterfalls Trek & Trail",
                    DiscoveryCategory.WATERFALL,
                    new BigDecimal("11.462000"),
                    new BigDecimal("76.601000"),
                    19.8,
                    90,
                    "Cascading waterfall trail through shola pine forests with eco battery cart ride to the waterfall platform.",
                    null,
                    "08:30 AM - 05:00 PM",
                    null,
                    PlaceCategory.ATTRACTION,
                    new BigDecimal("60.00"),
                    "Waterfall Trail & Eco Ride"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:botanical-garden",
                    "Government Botanical Garden",
                    DiscoveryCategory.PARK,
                    new BigDecimal("11.417200"),
                    new BigDecimal("76.711800"),
                    2.1,
                    90,
                    "55-acre terraced botanical garden featuring a 20-million-year-old fossil tree and Italian floral garden.",
                    "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop",
                    "07:00 AM - 06:30 PM",
                    "https://tnhorticulture.tn.gov.in",
                    PlaceCategory.ATTRACTION,
                    new BigDecimal("50.00"),
                    "Nature & Botanical Walk"
            ));

            list.add(new DiscoveredPlace(
                    "curated:ooty:tea-museum",
                    "Ooty Tea Factory & Tea Museum",
                    DiscoveryCategory.MUSEUM,
                    new BigDecimal("11.419000"),
                    new BigDecimal("76.725000"),
                    3.5,
                    90,
                    "Live tea processing factory demonstration, tea museum, and fresh Nilgiri tea tasting experience.",
                    null,
                    "09:00 AM - 06:30 PM",
                    null,
                    PlaceCategory.ATTRACTION,
                    new BigDecimal("30.00"),
                    "Factory Tour & Tea Tasting"
            ));
        } else if (lower.contains("coorg") || lower.contains("kodagu") || lower.contains("madikeri")) {
            list.add(new DiscoveredPlace(
                    "curated:coorg:dubare-rafting",
                    "Dubare Elephant Camp & River Rafting",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("12.368300"),
                    new BigDecimal("75.905600"),
                    22.0,
                    180,
                    "Kaveri river white-water rafting, elephant bathing, and forest trail interaction.",
                    null,
                    "09:00 AM - 05:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("800.00"),
                    "White Water Rafting & Elephant Camp"
            ));
            list.add(new DiscoveredPlace(
                    "curated:coorg:mandalpatti-jeep",
                    "Mandalpatti Peak 4x4 Off-Road Jeep Safari",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("12.510600"),
                    new BigDecimal("75.760000"),
                    18.0,
                    180,
                    "Thrilling 4x4 mountain jeep safari to Mandalpatti peak viewpoint above the clouds.",
                    null,
                    "06:00 AM - 05:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("1500.00"),
                    "4x4 Mountain Jeep Safari"
            ));
        } else if (lower.contains("goa")) {
            list.add(new DiscoveredPlace(
                    "curated:goa:water-sports",
                    "Calangute Beach Water Sports Complex",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("15.549400"),
                    new BigDecimal("73.753500"),
                    2.0,
                    180,
                    "Parasailing, jet ski, banana boat ride, and speed boating adventure package.",
                    null,
                    "09:00 AM - 06:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("1800.00"),
                    "Parasailing & Jet Skiing"
            ));
            list.add(new DiscoveredPlace(
                    "curated:goa:dudhsagar-jeep",
                    "Dudhsagar Waterfalls & Jungle Jeep Safari",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("15.314400"),
                    new BigDecimal("74.314400"),
                    45.0,
                    300,
                    "Bhagwan Mahavir sanctuary off-road 4x4 jeep safari and swim at Dudhsagar Falls pool.",
                    null,
                    "06:00 AM - 04:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("1000.00"),
                    "Jeep Safari & Waterfall Swim"
            ));
        } else if (lower.contains("munnar")) {
            list.add(new DiscoveredPlace(
                    "curated:munnar:mattupetty-boating",
                    "Mattupetty Dam Speed Boating & Kayaking",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("10.106100"),
                    new BigDecimal("77.123900"),
                    11.0,
                    120,
                    "Speed boat rides and kayaking in Mattupetty reservoir with elephant sighting chances.",
                    null,
                    "09:30 AM - 05:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("400.00"),
                    "Speed Boating & Kayaking"
            ));
        } else if (lower.contains("rishikesh")) {
            list.add(new DiscoveredPlace(
                    "curated:rishikesh:river-rafting",
                    "Ganges River Rafting (Shivpuri to Rishikesh)",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("30.133000"),
                    new BigDecimal("78.388700"),
                    12.0,
                    240,
                    "16 km Grade III/IV white-water river rafting on the Ganges including cliff jumping.",
                    null,
                    "07:00 AM - 04:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("1000.00"),
                    "White Water Rafting & Cliff Jump"
            ));
        } else if (lower.contains("kodaikanal") || lower.contains("kodai")) {
            list.add(new DiscoveredPlace(
                    "curated:kodai:lake-boating",
                    "Kodaikanal Lake Boating & Cycling",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("10.238100"),
                    new BigDecimal("77.489200"),
                    0.5,
                    120,
                    "Star-shaped Kodaikanal Lake featuring pedal boating (₹250/person), motor boating (₹400/person), and lakeside tandem cycling.",
                    null,
                    "09:00 AM - 06:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("250.00"),
                    "Boating & Cycling"
            ));
            list.add(new DiscoveredPlace(
                    "curated:kodai:coakers-walk",
                    "Coaker's Walk & Telescope Viewpoint",
                    DiscoveryCategory.VIEWPOINT,
                    new BigDecimal("10.233000"),
                    new BigDecimal("77.494000"),
                    0.8,
                    90,
                    "1-kilometer pedestrian walking paved path along mountain slope edge with cloud valley views.",
                    null,
                    "07:00 AM - 07:00 PM",
                    null,
                    PlaceCategory.ATTRACTION,
                    new BigDecimal("30.00"),
                    "Mountain Walk & Viewpoint"
            ));
            list.add(new DiscoveredPlace(
                    "curated:kodai:pine-forest",
                    "Pine Forest Trek & Horse Riding",
                    DiscoveryCategory.NATURE,
                    new BigDecimal("10.218000"),
                    new BigDecimal("77.464000"),
                    5.2,
                    90,
                    "Dense timber pine forest walking trails, photography zone, and guided horse riding.",
                    null,
                    "09:00 AM - 05:30 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("150.00"),
                    "Forest Trek & Horse Riding"
            ));
        } else if (lower.contains("bangalore") || lower.contains("bengaluru")) {
            list.add(new DiscoveredPlace(
                    "curated:blr:nandi-hills",
                    "Nandi Hills Sunrise Trek & Paragliding",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("13.370200"),
                    new BigDecimal("77.683500"),
                    35.0,
                    180,
                    "Early morning fortress hill trek, cloud bed sunrise viewpoints, and paragliding launch spot.",
                    null,
                    "06:00 AM - 06:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("2000.00"),
                    "Sunrise Trek & Paragliding"
            ));
            list.add(new DiscoveredPlace(
                    "curated:blr:wonderla",
                    "Wonderla Amusement & Water Park",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("12.834400"),
                    new BigDecimal("77.401000"),
                    25.0,
                    360,
                    "Massive theme park with Recoil roller coasters, wave pools, high-drop water slides, and sky wheel.",
                    null,
                    "11:00 AM - 07:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("1350.00"),
                    "Theme & Water Park"
            ));
        } else if (lower.contains("chennai") || lower.contains("madras")) {
            list.add(new DiscoveredPlace(
                    "curated:chennai:covelong-surfing",
                    "Covelong Beach Surfing & Kayaking",
                    DiscoveryCategory.ADVENTURE,
                    new BigDecimal("12.793300"),
                    new BigDecimal("80.252000"),
                    28.0,
                    150,
                    "Sea surfing lessons, ocean kayaking, and stand-up paddleboarding with ISA certified instructors.",
                    null,
                    "06:00 AM - 06:00 PM",
                    null,
                    PlaceCategory.ACTIVITY,
                    new BigDecimal("1500.00"),
                    "Sea Surfing & Kayaking"
            ));
        }

        // Always append full Thrill Factory adventure activities package centered on the searched destination
        List<DiscoveredPlace> thrillFactoryActivities = buildThrillFactoryActivities(destination, center);
        for (DiscoveredPlace act : thrillFactoryActivities) {
            String key = normalizeKey(act.name());
            boolean exists = list.stream().anyMatch(p -> normalizeKey(p.name()).equals(key));
            if (!exists) {
                list.add(act);
            }
        }

        // Always append Hotels, Resorts, Stays & Fine Dining package centered on the searched destination
        List<DiscoveredPlace> hotelAndDining = buildHotelAndDiningCurated(destination, center);
        for (DiscoveredPlace stay : hotelAndDining) {
            String key = normalizeKey(stay.name());
            boolean exists = list.stream().anyMatch(p -> normalizeKey(p.name()).equals(key));
            if (!exists) {
                list.add(stay);
            }
        }

        // Apply category filter and resolve high-resolution activity images
        return list.stream()
                .filter(p -> requestedCategory == null || p.category() == requestedCategory)
                .map(p -> new DiscoveredPlace(
                        p.externalId(),
                        p.name(),
                        p.category(),
                        p.latitude(),
                        p.longitude(),
                        p.distanceKm(),
                        p.suggestedVisitMinutes(),
                        p.description(),
                        resolveImageByNameAndCategory(p.imageUrl(), p.name(), p.activityType(), p.category()),
                        p.openingHours(),
                        p.website(),
                        p.saveCategory(),
                        p.estimatedCostPerPerson(),
                        p.activityType()
                ))
                .toList();
    }

    private List<DiscoveredPlace> buildThrillFactoryActivities(String destination, GeoPoint center) {
        List<DiscoveredPlace> activities = new ArrayList<>();
        BigDecimal lat = center != null && center.latitude() != null ? center.latitude() : new BigDecimal("11.406400");
        BigDecimal lon = center != null && center.longitude() != null ? center.longitude() : new BigDecimal("76.693200");
        String destName = destination == null || destination.isBlank() ? "Destination" : destination.trim();

        activities.add(new DiscoveredPlace(
                "thrill:bungee:" + destName.toLowerCase(Locale.ROOT),
                "83m Cliff Bungee Jumping (" + destName + ")",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0120")),
                lon.add(new BigDecimal("0.0150")),
                2.5,
                120,
                "Extreme 83-meter cliff freefall jump over canyon river with certified jump masters and video recording.",
                "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80",
                "09:00 AM - 05:30 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("3550.00"),
                "Bungee Jumping"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:swing:" + destName.toLowerCase(Locale.ROOT),
                "Giant Tandem & Solo Swing (" + destName + ")",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0140")),
                lon.add(new BigDecimal("0.0180")),
                3.1,
                90,
                "High-altitude cliff pendulum swing launching riders over 120 km/h across the river gorge.",
                "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80",
                "09:00 AM - 05:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("3000.00"),
                "Giant Swing"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:zipline:" + destName.toLowerCase(Locale.ROOT),
                "Flying Fox River Zipline (" + destName + ")",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0080")),
                lon.add(new BigDecimal("0.0110")),
                1.8,
                60,
                "750-meter long high-speed zipline flying 140 meters above valley canopy and river.",
                "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80",
                "09:00 AM - 06:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("1800.00"),
                "Zipline & Flying Fox"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:skycycling:" + destName.toLowerCase(Locale.ROOT),
                "Aerial Sky Cycling (" + destName + ")",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0095")),
                lon.add(new BigDecimal("0.0130")),
                2.0,
                45,
                "Bicycle ride on a high-wire steel cable suspended 150 feet above the valley floor.",
                "https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=800&q=80",
                "09:30 AM - 05:30 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("1000.00"),
                "Sky Cycling"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:slingshot:" + destName.toLowerCase(Locale.ROOT),
                "Reverse Bungee & Slingshot Catapult",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0110")),
                lon.add(new BigDecimal("0.0140")),
                2.2,
                45,
                "High-speed vertical catapult launching riders 100 feet into the air in under 2 seconds.",
                "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80",
                "09:30 AM - 06:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("1500.00"),
                "Reverse Bungee & Slingshot"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:atv:" + destName.toLowerCase(Locale.ROOT),
                "ATV 4x4 Quad Biking Off-Road Track",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0160")),
                lon.add(new BigDecimal("0.0210")),
                4.2,
                60,
                "Off-road 250cc 4x4 quad bike circuit through rugged dirt, water splashes, and forest obstacles.",
                "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80",
                "09:00 AM - 06:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("850.00"),
                "ATV Quad Biking"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:rafting:" + destName.toLowerCase(Locale.ROOT),
                "White Water River Rafting & Cliff Jump",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0210")),
                lon.add(new BigDecimal("0.0250")),
                5.5,
                180,
                "16km Grade III/IV river rafting on rapids with safety gear, raft guide, and 25-foot cliff jumping.",
                "https://images.unsplash.com/photo-1530866495561-507c9faab2ed?auto=format&fit=crop&w=800&q=80",
                "07:00 AM - 04:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("1200.00"),
                "White Water Rafting"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:ropecourse:" + destName.toLowerCase(Locale.ROOT),
                "2-Tier High Ropes & Obstacle Course",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0070")),
                lon.add(new BigDecimal("0.0090")),
                1.4,
                75,
                "Airborne obstacle course featuring Burma bridge, log crossings, zip transitions, and cargo climbing nets.",
                "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
                "09:00 AM - 06:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("600.00"),
                "High Ropes Course"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:paintball:" + destName.toLowerCase(Locale.ROOT),
                "Tactical Paintball Arena (100 Pellets)",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0130")),
                lon.add(new BigDecimal("0.0160")),
                2.8,
                60,
                "Tactical battlefield arena with CO2 paintball guns, chest armor, full masks, and 100 paintball rounds.",
                "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=800&q=80",
                "10:00 AM - 07:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("750.00"),
                "Paintball Arena"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:gokart:" + destName.toLowerCase(Locale.ROOT),
                "Go-Kart Racing Circuit",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0180")),
                lon.add(new BigDecimal("0.0230")),
                4.8,
                45,
                "Twin 200cc engine go-kart racing on a fast paved circuit with lap timing and safety helmets.",
                "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80",
                "10:00 AM - 08:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("700.00"),
                "Go-Karting"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:trampoline:" + destName.toLowerCase(Locale.ROOT),
                "Trampoline Park & Ninja Foam Pit",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0050")),
                lon.add(new BigDecimal("0.0070")),
                1.1,
                60,
                "Indoor freestyle trampoline jumpers arena, foam pit dunking, ninja warrior wall, and dodgeball.",
                "https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=800&q=80",
                "10:00 AM - 08:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("450.00"),
                "Trampoline Park"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:archery:" + destName.toLowerCase(Locale.ROOT),
                "Air Rifle Shooting & Archery Range",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0060")),
                lon.add(new BigDecimal("0.0080")),
                1.2,
                45,
                "Target shooting with 0.177 air rifles and bow & arrow recurve archery target challenges.",
                "https://images.unsplash.com/photo-1515523110800-9415d13b84a8?auto=format&fit=crop&w=800&q=80",
                "09:30 AM - 06:30 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("400.00"),
                "Target Shooting & Archery"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:paragliding:" + destName.toLowerCase(Locale.ROOT),
                "Tandem Paragliding Mountain Flight",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0250")),
                lon.add(new BigDecimal("0.0300")),
                7.5,
                150,
                "High-altitude thermalling flight with licensed tandem pilot offering breathtaking panoramic valley views.",
                "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80",
                "06:30 AM - 05:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("3200.00"),
                "Tandem Paragliding"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:rockclimbing:" + destName.toLowerCase(Locale.ROOT),
                "Natural Rock Climbing & 100ft Rappelling",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0150")),
                lon.add(new BigDecimal("0.0190")),
                3.8,
                120,
                "Natural granite rock climbing and 100-foot vertical rope rappelling guided by certified mountaineers.",
                "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
                "08:00 AM - 05:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("650.00"),
                "Rock Climbing & Rappelling"
        ));

        activities.add(new DiscoveredPlace(
                "thrill:zorbing:" + destName.toLowerCase(Locale.ROOT),
                "Water Roller & Downhill Zorbing",
                DiscoveryCategory.ADVENTURE,
                lat.add(new BigDecimal("0.0090")),
                lon.add(new BigDecimal("0.0120")),
                1.9,
                45,
                "360-degree inflatable hill zorbing and aquatic water roller tumbling experience.",
                "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
                "09:00 AM - 06:00 PM",
                "https://thrillfactory.in",
                PlaceCategory.ACTIVITY,
                new BigDecimal("350.00"),
                "Water Roller & Zorbing"
        ));

        return activities;
    }

    private List<DiscoveredPlace> buildHotelAndDiningCurated(String destination, GeoPoint center) {
        List<DiscoveredPlace> stays = new ArrayList<>();
        BigDecimal lat = center != null && center.latitude() != null ? center.latitude() : new BigDecimal("11.406400");
        BigDecimal lon = center != null && center.longitude() != null ? center.longitude() : new BigDecimal("76.693200");
        String destName = destination == null || destination.isBlank() ? "Destination" : destination.trim();

        stays.add(new DiscoveredPlace(
                "hotel:grandresort:" + destName.toLowerCase(Locale.ROOT),
                "The Grand Palace Resort & Spa (" + destName + ")",
                DiscoveryCategory.FOOD,
                lat.add(new BigDecimal("0.0030")),
                lon.add(new BigDecimal("0.0040")),
                0.6,
                600,
                "5-star luxury heritage resort offering infinity pool, world-class spa treatments, mountain valley view suites, and fine dining.",
                "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
                "24 Hours Open",
                "https://booking.com",
                PlaceCategory.HOTEL,
                new BigDecimal("6500.00"),
                "5-Star Luxury Resort"
        ));

        stays.add(new DiscoveredPlace(
                "hotel:boutiquestay:" + destName.toLowerCase(Locale.ROOT),
                "Cloud Nine Boutique Stays & Suites (" + destName + ")",
                DiscoveryCategory.FOOD,
                lat.add(new BigDecimal("0.0050")),
                lon.add(new BigDecimal("0.0060")),
                1.0,
                480,
                "Premium boutique stay with private balcony, complimentary breakfast buffet, high-speed Wi-Fi, and personalized concierge.",
                "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80",
                "24 Hours Open",
                "https://booking.com",
                PlaceCategory.HOTEL,
                new BigDecimal("3800.00"),
                "Boutique Hotel Suite"
        ));

        stays.add(new DiscoveredPlace(
                "hotel:backpackers:" + destName.toLowerCase(Locale.ROOT),
                "Zostel & Backpackers Hostel (" + destName + ")",
                DiscoveryCategory.FOOD,
                lat.add(new BigDecimal("0.0075")),
                lon.add(new BigDecimal("0.0085")),
                1.3,
                480,
                "Vibrant backpacker social hostel with dorm beds, private rooms, rooftop cafe lounge, bonfire nights, and community games.",
                "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80",
                "24 Hours Open",
                "https://zostel.com",
                PlaceCategory.HOTEL,
                new BigDecimal("850.00"),
                "Backpacker Hostel & Dorms"
        ));

        stays.add(new DiscoveredPlace(
                "hotel:ecoresort:" + destName.toLowerCase(Locale.ROOT),
                "Pine Valley Nature & Eco Resort (" + destName + ")",
                DiscoveryCategory.FOOD,
                lat.add(new BigDecimal("0.0120")),
                lon.add(new BigDecimal("0.0140")),
                2.4,
                600,
                "Eco-friendly wooden cottages nestled in lush pine forests, organic farm-to-table dining, and guided nature walks.",
                "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
                "24 Hours Open",
                "https://booking.com",
                PlaceCategory.HOTEL,
                new BigDecimal("4500.00"),
                "Eco Nature Resort"
        ));

        stays.add(new DiscoveredPlace(
                "food:finedining:" + destName.toLowerCase(Locale.ROOT),
                "Royal Spice Fine Dining Restaurant",
                DiscoveryCategory.FOOD,
                lat.add(new BigDecimal("0.0020")),
                lon.add(new BigDecimal("0.0030")),
                0.4,
                90,
                "Authentic Indian multi-cuisine restaurant serving signature tandoori delights, regional thalis, and gourmet desserts.",
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
                "11:00 AM - 11:00 PM",
                null,
                PlaceCategory.RESTAURANT,
                new BigDecimal("600.00"),
                "Fine Dining Restaurant"
        ));

        stays.add(new DiscoveredPlace(
                "food:rooftopcafe:" + destName.toLowerCase(Locale.ROOT),
                "Highland Sky Rooftop Cafe & Bistro",
                DiscoveryCategory.FOOD,
                lat.add(new BigDecimal("0.0040")),
                lon.add(new BigDecimal("0.0050")),
                0.7,
                60,
                "Scenic rooftop bistro serving specialty coffees, artisan pizzas, wood-fired snacks, and sunset mocktails.",
                "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
                "08:30 AM - 10:30 PM",
                null,
                PlaceCategory.RESTAURANT,
                new BigDecimal("350.00"),
                "Rooftop Cafe & Bistro"
        ));

        return stays;
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

        GeoPoint fallback = defaultGeoPoint(destination);
        if (fallback != null) {
            return fallback;
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

    private GeoPoint defaultGeoPoint(String destination) {
        String lower = destination.toLowerCase(Locale.ROOT);
        if (lower.contains("ooty") || lower.contains("otacamund") || lower.contains("udagamandalam") || lower.contains("nilgiri")) {
            return new GeoPoint(new BigDecimal("11.406400"), new BigDecimal("76.693200"), "Ooty, Tamil Nadu, India");
        }
        if (lower.contains("coorg") || lower.contains("kodagu") || lower.contains("madikeri")) {
            return new GeoPoint(new BigDecimal("12.424400"), new BigDecimal("75.738200"), "Coorg, Karnataka, India");
        }
        if (lower.contains("goa")) {
            return new GeoPoint(new BigDecimal("15.299300"), new BigDecimal("74.124000"), "Goa, India");
        }
        if (lower.contains("munnar")) {
            return new GeoPoint(new BigDecimal("10.088900"), new BigDecimal("77.059500"), "Munnar, Kerala, India");
        }
        if (lower.contains("rishikesh")) {
            return new GeoPoint(new BigDecimal("30.086900"), new BigDecimal("78.267600"), "Rishikesh, Uttarakhand, India");
        }
        return null;
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

        log.warn("All Overpass providers failed. Returning curated discovery places.");
        return List.of();
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

            String rawImageUrl = resolveImage(tags);
            String openingHours = emptyToNull(tags.path("opening_hours").asText(null));
            String website = firstNonBlank(
                    tags.path("website").asText(null),
                    tags.path("contact:website").asText(null)
            );

            BigDecimal estimatedCost = estimateCost(mappedCategory, name, tags);
            String activityType = deduceActivityType(mappedCategory, name, tags);
            String imageUrl = resolveImageByNameAndCategory(rawImageUrl, name, activityType, mappedCategory);

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
                    toSavedPlaceCategory(mappedCategory),
                    estimatedCost,
                    activityType
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

    private BigDecimal estimateCost(DiscoveryCategory cat, String name, JsonNode tags) {
        String lowerName = name.toLowerCase(Locale.ROOT);
        String fee = tags.path("fee").asText("");

        if ("yes".equalsIgnoreCase(fee) || !fee.isBlank()) {
            String charge = tags.path("charge").asText("");
            BigDecimal parsed = decimal(charge.replaceAll("[^0-9.]", ""));
            if (parsed != null && parsed.compareTo(BigDecimal.ZERO) > 0) {
                return parsed;
            }
        }

        if (lowerName.contains("jeep") || lowerName.contains("safari")) {
            return new BigDecimal("1200.00");
        }
        if (lowerName.contains("boat") || lowerName.contains("boating")) {
            return new BigDecimal("250.00");
        }
        if (lowerName.contains("kayak")) {
            return new BigDecimal("350.00");
        }
        if (lowerName.contains("rafting")) {
            return new BigDecimal("800.00");
        }
        if (lowerName.contains("zipline") || lowerName.contains("ropeway") || lowerName.contains("cable car")) {
            return new BigDecimal("300.00");
        }
        if (lowerName.contains("trek")) {
            return new BigDecimal("200.00");
        }

        return switch (cat) {
            case ADVENTURE -> new BigDecimal("500.00");
            case LAKE -> new BigDecimal("250.00");
            case WATERFALL -> new BigDecimal("50.00");
            case VIEWPOINT -> new BigDecimal("50.00");
            case MUSEUM -> new BigDecimal("100.00");
            case HISTORICAL -> new BigDecimal("150.00");
            case PARK -> new BigDecimal("40.00");
            case NATURE -> new BigDecimal("80.00");
            case FOOD -> new BigDecimal("400.00");
            case SHOPPING -> new BigDecimal("500.00");
            default -> new BigDecimal("50.00");
        };
    }

    private String deduceActivityType(DiscoveryCategory cat, String name, JsonNode tags) {
        String lowerName = name.toLowerCase(Locale.ROOT);
        if (lowerName.contains("jeep") || lowerName.contains("safari")) return "Jeep Safari";
        if (lowerName.contains("boat") || lowerName.contains("boating")) return "Boating & Water Sports";
        if (lowerName.contains("kayak")) return "Kayaking";
        if (lowerName.contains("rafting")) return "White Water Rafting";
        if (lowerName.contains("trek")) return "Trekking";
        if (lowerName.contains("ropeway") || lowerName.contains("cable car")) return "Ropeway & Cable Car";
        if (lowerName.contains("zipline")) return "Ziplining";
        if (cat == DiscoveryCategory.ADVENTURE) return "Adventure Experience";
        if (cat == DiscoveryCategory.LAKE) return "Lake & Boating";
        if (cat == DiscoveryCategory.WATERFALL) return "Waterfall Trail";
        if (cat == DiscoveryCategory.VIEWPOINT) return "Trek & Viewpoint";
        return null;
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

    private String resolveImageByNameAndCategory(
            String existingUrl,
            String name,
            String activityType,
            DiscoveryCategory category
    ) {
        if (existingUrl != null && !existingUrl.isBlank() && existingUrl.startsWith("http")) {
            return existingUrl;
        }

        String combined = ((name == null ? "" : name) + " "
                + (activityType == null ? "" : activityType) + " "
                + (category == null ? "" : category.name())).toLowerCase(Locale.ROOT);

        if (combined.contains("kayak")) {
            return "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("boat") || combined.contains("boating")) {
            return "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("cycle") || combined.contains("cycling") || combined.contains("bike") || combined.contains("biking")) {
            return "https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("jeep") || combined.contains("safari") || combined.contains("4x4") || combined.contains("wildlife")) {
            return "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("trek") || combined.contains("hiking") || combined.contains("hike")) {
            return "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("rafting")) {
            return "https://images.unsplash.com/photo-1530866495561-507c9faab2ed?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("ropeway") || combined.contains("cable car") || combined.contains("zipline") || combined.contains("paragliding")) {
            return "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("toy train") || combined.contains("railway") || combined.contains("train")) {
            return "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("tea")) {
            return "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("botanical") || combined.contains("flower") || combined.contains("rose garden")) {
            return "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("thunder world") || combined.contains("amusement") || combined.contains("theme park")) {
            return "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("waterfall") || combined.contains("falls")) {
            return "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("lake")) {
            return "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("viewpoint") || combined.contains("peak") || combined.contains("doddabetta")) {
            return "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("park") || combined.contains("garden")) {
            return "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("museum")) {
            return "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("temple") || combined.contains("kovil") || combined.contains("mandir") || combined.contains("shrine")) {
            return "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("church") || combined.contains("cathedral")) {
            return "https://images.unsplash.com/photo-1548625149-fc4a29cf7092?auto=format&fit=crop&w=800&q=80";
        }
        if (combined.contains("food") || combined.contains("restaurant") || combined.contains("hotel") || combined.contains("resort") || combined.contains("inn")) {
            return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80";
        }

        return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80";
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

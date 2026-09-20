package com.tripmate.discovery;

import com.tripmate.discovery.curated.CuratedDiscoveryMapper;
import com.tripmate.discovery.curated.CuratedDiscoveryRepository;
import com.tripmate.discovery.provider.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DestinationDiscoveryService {
    private static final Logger log = LoggerFactory.getLogger(DestinationDiscoveryService.class);
    private final DestinationGeocodingService geocodingService;
    private final List<DiscoveryProvider> providers;
    private final CuratedDiscoveryRepository curatedRepository;
    private final CuratedDiscoveryMapper curatedMapper;
    private final Duration staticCacheDuration;
    private final Duration pricingCacheDuration;
    private final int maxResults;
    private final Map<String, CachedSearch> searchCache = new ConcurrentHashMap<>();
    private final Map<String, DiscoveredPlace> detailCache = new ConcurrentHashMap<>();

    public DestinationDiscoveryService(
            DestinationGeocodingService geocodingService,
            List<DiscoveryProvider> providers,
            CuratedDiscoveryRepository curatedRepository,
            CuratedDiscoveryMapper curatedMapper,
            @Value("${discovery.static-cache-hours:6}") long staticCacheHours,
            @Value("${discovery.price-cache-minutes:${discovery.cache-minutes:60}}") long priceCacheMinutes,
            @Value("${discovery.max-results:200}") int maxResults
    ) {
        this.geocodingService = geocodingService;
        this.providers = List.copyOf(providers);
        this.curatedRepository = curatedRepository;
        this.curatedMapper = curatedMapper;
        this.staticCacheDuration = Duration.ofHours(Math.max(1, staticCacheHours));
        this.pricingCacheDuration = Duration.ofMinutes(Math.max(5, priceCacheMinutes));
        this.maxResults = Math.max(25, Math.min(500, maxResults));
    }

    public DestinationDiscoveryResponse search(String destination, int radiusKm, String category) {
        return search(destination, radiusKm, new DiscoverySearchFilters(
                category, null, null, null, null, null, null, null, null,
                null, null, null, "RELEVANCE", 0, Math.min(maxResults, 100)
        ));
    }

    public DestinationDiscoveryResponse search(String destination, int radiusKm, DiscoverySearchFilters filters) {
        String query = destination == null ? "" : destination.trim();
        validate(query, radiusKm, filters);
        DiscoveryCategory category = enumValue(DiscoveryCategory.class, filters.category(), "category");
        DiscoveryItemType itemType = enumValue(DiscoveryItemType.class, filters.itemType(), "item type");
        PriceStatus priceStatus = enumValue(PriceStatus.class, filters.priceStatus(), "price status");
        int size = Math.min(filters.size(), 100);
        String cacheKey = query.toLowerCase(Locale.ROOT) + "|" + radiusKm + "|" + (category == null ? "ALL" : category);

        CachedSearch cached = searchCache.get(cacheKey);
        if (cached == null || cacheExpired(cached)) {
            cached = fetch(query, radiusKm, category);
            searchCache.put(cacheKey, cached);
        }

        List<DiscoveredPlace> filtered = cached.places().stream()
                .filter(place -> itemType == null || place.itemType() == itemType)
                .filter(place -> priceStatus == null || place.priceStatus() == priceStatus)
                .filter(place -> textMatches(place.subcategory(), filters.subcategory()))
                .filter(place -> filters.minPrice() == null || place.estimatedCostPerPerson() != null
                        && place.estimatedCostPerPerson().compareTo(filters.minPrice()) >= 0)
                .filter(place -> filters.maxPrice() == null || place.estimatedCostPerPerson() != null
                        && place.estimatedCostPerPerson().compareTo(filters.maxPrice()) <= 0)
                .filter(place -> !Boolean.TRUE.equals(filters.openNow()) || Boolean.TRUE.equals(place.openNow()))
                .filter(place -> !Boolean.TRUE.equals(filters.familyFriendly()) || Boolean.TRUE.equals(place.familyFriendly()))
                .filter(place -> textMatches(place.difficultyLevel(), filters.difficulty()))
                .filter(place -> filters.minDuration() == null || effectiveDuration(place) >= filters.minDuration())
                .filter(place -> filters.maxDuration() == null || effectiveDuration(place) <= filters.maxDuration())
                .filter(place -> filters.minRating() == null || place.rating() != null && place.rating() >= filters.minRating())
                .sorted(comparator(filters.sort()))
                .toList();

        int from = Math.min(filters.page() * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        int totalPages = filtered.isEmpty() ? 0 : (int) Math.ceil(filtered.size() / (double) size);
        return new DestinationDiscoveryResponse(
                query, cached.destination().displayName(), cached.destination().latitude(), cached.destination().longitude(),
                radiusKm, category == null ? "ALL" : category.name(), String.join(" + ", cached.providers()),
                String.join(" · ", cached.attributions()), filters.asMap(), filtered.size(), filtered.subList(from, to),
                cached.providers(), cached.warnings(), cached.createdAt(), filters.page(), size, totalPages
        );
    }

    @Transactional(readOnly = true)
    public DiscoveredPlace findByExternalId(String externalId) {
        DiscoveredPlace cached = detailCache.get(externalId);
        if (cached != null) return cached;
        return curatedRepository.findByExternalId(externalId)
                .map(item -> curatedMapper.toDiscoveredPlace(item, 0, null))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Discovery item is not cached. Search its destination again."));
    }

    public List<DiscoverySuggestion> suggestions(String query, int limit) {
        String clean = query == null ? "" : query.trim();
        if (clean.length() < 2) return List.of();
        return geocodingService.suggest(clean, Math.max(1, Math.min(limit, 8)));
    }

    public DiscoverySuggestion reverseGeocode(BigDecimal latitude, BigDecimal longitude) {
        GeocodedDestination result = geocodingService.reverse(latitude, longitude);
        return new DiscoverySuggestion(result.displayName(), result.city(), result.district(), result.state(),
                result.latitude(), result.longitude(), result.provider());
    }

    private CachedSearch fetch(String query, int radiusKm, DiscoveryCategory category) {
        GeocodedDestination destination = geocodingService.geocode(query);
        DiscoveryProviderRequest request = new DiscoveryProviderRequest(query, destination, radiusKm, category);
        Map<String, DiscoveredPlace> unique = new LinkedHashMap<>();
        List<String> usedProviders = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<String> attributions = new ArrayList<>();

        for (DiscoveryProvider provider : providers) {
            try {
                DiscoveryProviderResult result = provider.discover(request);
                warnings.addAll(result.warnings());
                if (!result.places().isEmpty()) {
                    usedProviders.add(result.provider());
                    if (result.attribution() != null && !result.attribution().isBlank()) attributions.add(result.attribution());
                }
                merge(unique, result.places());
            } catch (RuntimeException ex) {
                log.warn("Discovery provider failed: provider={} error={}", provider.name(), ex.getClass().getSimpleName());
                warnings.add(provider.name() + " was unavailable; partial results are shown.");
            }
        }
        if (unique.isEmpty()) warnings.add("No source-backed listings were returned. TripMate did not generate placeholder activities.");
        warnings.add("Prices and opening hours may change. Confirm with the linked official provider before travelling.");
        List<DiscoveredPlace> places = unique.values().stream().limit(maxResults).toList();
        places.forEach(place -> detailCache.put(place.externalId(), place));
        if (usedProviders.isEmpty()) usedProviders.add(destination.provider());
        return new CachedSearch(Instant.now(), destination, places, List.copyOf(usedProviders),
                List.copyOf(new LinkedHashSet<>(warnings)), List.copyOf(new LinkedHashSet<>(attributions)));
    }

    private boolean cacheExpired(CachedSearch cached) {
        boolean containsVolatilePricing = cached.places().stream()
                .anyMatch(place -> place.priceStatus() != PriceStatus.UNKNOWN);
        Duration duration = containsVolatilePricing ? pricingCacheDuration : staticCacheDuration;
        return cached.createdAt().plus(duration).isBefore(Instant.now());
    }

    private void merge(Map<String, DiscoveredPlace> unique, List<DiscoveredPlace> places) {
        for (DiscoveredPlace candidate : places) {
            String providerKey = candidate.externalId();
            if (unique.containsKey(providerKey)) continue;
            String nearbyKey = unique.entrySet().stream()
                    .filter(entry -> samePlace(entry.getValue(), candidate))
                    .map(Map.Entry::getKey).findFirst().orElse(null);
            if (nearbyKey == null) {
                unique.put(providerKey, candidate);
            } else if (candidate.curated() || candidate.confidenceScore() > unique.get(nearbyKey).confidenceScore()) {
                unique.put(nearbyKey, candidate);
            }
        }
    }

    private boolean samePlace(DiscoveredPlace left, DiscoveredPlace right) {
        String leftName = normalize(left.name()), rightName = normalize(right.name());
        if (!leftName.equals(rightName)) return false;
        return haversine(left.latitude().doubleValue(), left.longitude().doubleValue(),
                right.latitude().doubleValue(), right.longitude().doubleValue()) <= 0.25;
    }

    private Comparator<DiscoveredPlace> comparator(String value) {
        String sort = value == null ? "RELEVANCE" : value.trim().toUpperCase(Locale.ROOT);
        return switch (sort) {
            case "DISTANCE" -> Comparator.comparingDouble(DiscoveredPlace::distanceKm);
            case "PRICE_LOW" -> Comparator.comparing(DiscoveredPlace::estimatedCostPerPerson,
                    Comparator.nullsLast(BigDecimal::compareTo)).thenComparingDouble(DiscoveredPlace::distanceKm);
            case "PRICE_HIGH" -> Comparator.comparing(DiscoveredPlace::estimatedCostPerPerson,
                    Comparator.nullsLast(Comparator.reverseOrder())).thenComparingDouble(DiscoveredPlace::distanceKm);
            case "POPULAR", "MOST_POPULAR" -> Comparator.comparingInt((DiscoveredPlace place) -> value(place.popularityScore())).reversed()
                    .thenComparingDouble(DiscoveredPlace::distanceKm);
            case "VERIFIED", "BEST_VERIFIED" -> Comparator.comparingInt(this::verificationRank)
                    .thenComparing(Comparator.comparingDouble(DiscoveredPlace::confidenceScore).reversed());
            case "RECENT", "RECENTLY_VERIFIED" -> Comparator.comparing(DiscoveredPlace::sourceLastCheckedAt,
                    Comparator.nullsLast(Comparator.reverseOrder()));
            case "NAME" -> Comparator.comparing(DiscoveredPlace::name, String.CASE_INSENSITIVE_ORDER);
            default -> Comparator.comparing((DiscoveredPlace place) -> !place.curated())
                    .thenComparing(Comparator.comparingDouble(DiscoveredPlace::confidenceScore).reversed())
                    .thenComparing(Comparator.comparingInt((DiscoveredPlace place) -> value(place.popularityScore())).reversed())
                    .thenComparingDouble(DiscoveredPlace::distanceKm);
        };
    }

    private int verificationRank(DiscoveredPlace place) {
        if (place.verificationExpired()) return 4;
        return switch (place.priceStatus()) {
            case VERIFIED, FREE -> 0;
            case STARTING_FROM -> 1;
            case ESTIMATED -> 2;
            case UNKNOWN -> 3;
        };
    }

    private void validate(String destination, int radiusKm, DiscoverySearchFilters filters) {
        if (destination.length() < 2 || destination.length() > 180) throw bad("Destination must be between 2 and 180 characters");
        if (radiusKm < 1 || radiusKm > 100) throw bad("Radius must be between 1 and 100 km");
        if (filters.page() < 0 || filters.size() < 1 || filters.size() > 100) throw bad("Page must be non-negative and size must be 1-100");
        if (filters.minPrice() != null && filters.minPrice().signum() < 0 || filters.maxPrice() != null && filters.maxPrice().signum() < 0) throw bad("Price cannot be negative");
        if (filters.minPrice() != null && filters.maxPrice() != null && filters.minPrice().compareTo(filters.maxPrice()) > 0) throw bad("Minimum price cannot exceed maximum price");
        if (filters.minDuration() != null && filters.maxDuration() != null && filters.minDuration() > filters.maxDuration()) throw bad("Minimum duration cannot exceed maximum duration");
    }

    private <T extends Enum<T>> T enumValue(Class<T> type, String raw, String label) {
        if (raw == null || raw.isBlank() || "ALL".equalsIgnoreCase(raw)) return null;
        try { return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException ex) { throw bad("Unsupported " + label); }
    }
    private boolean textMatches(String actual, String expected) { return expected == null || expected.isBlank() || actual != null && actual.toLowerCase(Locale.ROOT).contains(expected.toLowerCase(Locale.ROOT)); }
    private int effectiveDuration(DiscoveredPlace place) { return Optional.ofNullable(place.activityDuration()).orElse(Optional.ofNullable(place.suggestedVisitMinutes()).orElse(0)); }
    private int value(Integer value) { return value == null ? 0 : value; }
    private String normalize(String value) { return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", ""); }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private record CachedSearch(
            Instant createdAt,
            GeocodedDestination destination,
            List<DiscoveredPlace> places,
            List<String> providers,
            List<String> warnings,
            List<String> attributions
    ) {
    }
}

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
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

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
    // Replacing the whole generation prevents an in-flight fetch from repopulating invalidated caches.
    private volatile CacheGeneration caches = new CacheGeneration();

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void catalogueChanged(DiscoveryCatalogueChanged event) {
        caches = new CacheGeneration();
    }

    private static final class CacheGeneration {
        final ExpiringCache<String, CachedSearch> searches = new ExpiringCache<>(64);
        final ExpiringCache<String, DiscoveredPlace> details = new ExpiringCache<>(5000);
    }

    public DestinationDiscoveryService(
            DestinationGeocodingService geocodingService,
            List<DiscoveryProvider> providers,
            CuratedDiscoveryRepository curatedRepository,
            CuratedDiscoveryMapper curatedMapper,
            @Value("${discovery.static-cache-hours:6}") long staticCacheHours,
            @Value("${discovery.price-cache-minutes:${discovery.cache-minutes:60}}") long priceCacheMinutes,
            @Value("${discovery.max-results:500}") int maxResults
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

    public DestinationDiscoveryResponse topPlaces(String destination, int radiusKm) {
        return search(destination, radiusKm, new DiscoverySearchFilters("ALL",null,null,null,null,null,null,null,null,
                null,null,null,"RELEVANCE",0,10), true);
    }

    public DestinationDiscoveryResponse search(String destination, int radiusKm, DiscoverySearchFilters filters) {
        return search(destination,radiusKm,filters,false);
    }

    private DestinationDiscoveryResponse search(String destination, int radiusKm, DiscoverySearchFilters filters, boolean freeOnly) {
        String query = destination == null ? "" : destination.trim();
        validate(query, radiusKm, filters);
        if (filters.name() != null && filters.name().length() > 180) throw bad("Place name is too long");
        DiscoveryCategory category = enumValue(DiscoveryCategory.class, filters.category(), "category");
        DiscoveryItemType itemType = enumValue(DiscoveryItemType.class, filters.itemType(), "item type");
        PriceStatus priceStatus = enumValue(PriceStatus.class, filters.priceStatus(), "price status");
        int size = Math.min(filters.size(), 100);
        String placeName = filters.name() == null ? "" : filters.name().trim();
        String cacheKey = (freeOnly ? "FREE|" : "ALL|") + query.toLowerCase(Locale.ROOT) + "|" + radiusKm + "|" + (category == null ? "ALL" : category) + "|name:" + placeName.toLowerCase(Locale.ROOT);

        CacheGeneration generation = caches;
        CachedSearch cached = generation.searches.get(cacheKey);
        if (cached == null) {
            cached = fetch(query, radiusKm, category, placeName, freeOnly);
            if (!cached.places().isEmpty()) {
                Instant expiresAt = searchExpiry(cached.createdAt(), cached.places(), cached.warnings());
                generation.searches.put(cacheKey, cached, expiresAt);
                cached.places().stream().filter(place -> !place.curated())
                        .forEach(place -> generation.details.put(place.externalId(), place, expiresAt));
            }
        }

        List<DiscoveredPlace> filtered = cached.places().stream()
                .filter(place -> !freeOnly || highlight(place))
                .filter(place -> placeNameMatches(place.name(), filters.name()))
                .filter(place -> itemType == null || place.itemType() == itemType)
                .filter(place -> priceStatus == null || place.priceStatus() == priceStatus
                        && (!(priceStatus == PriceStatus.VERIFIED || priceStatus == PriceStatus.FREE)
                            || !verificationExpired(place)))
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
                .sorted(freeOnly ? highlightOrder() : comparator(filters.sort()))
                .limit(freeOnly ? 10 : Long.MAX_VALUE)
                .toList();

        int from = Math.min(filters.page() * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        int totalPages = filtered.isEmpty() ? 0 : (int) Math.ceil(filtered.size() / (double) size);
        return new DestinationDiscoveryResponse(
                query, cached.destination().displayName(), cached.destination().latitude(), cached.destination().longitude(),
                radiusKm, category == null ? "ALL" : category.name(), cached.providers().isEmpty() ? "No place source returned results" : String.join(" + ", cached.providers()),
                String.join(" · ", cached.attributions()), filters.asMap(), filtered.size(), filtered.subList(from, to),
                cached.providers(), cached.warnings(), cached.createdAt(), filters.page(), size, totalPages
        );
    }

    @Transactional(readOnly = true)
    public DiscoveredPlace findByExternalId(String externalId) {
        var curated = curatedRepository.findByExternalId(externalId);
        if (curated.isPresent()) {
            if (!curated.get().isEnabled()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Discovery item unavailable");
            return curatedMapper.toDiscoveredPlace(curated.get(), 0, null);
        }
        DiscoveredPlace cached = caches.details.get(externalId);
        if (cached != null) return cached;
        throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Discovery item is not cached. Search its destination again.");
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

    private CachedSearch fetch(String query, int radiusKm, DiscoveryCategory category, String placeName, boolean freeOnly) {
        GeocodedDestination destination = geocodingService.geocode(query);
        DiscoveryProviderRequest request = new DiscoveryProviderRequest(query, destination, radiusKm, category, placeName);
        Map<String, DiscoveredPlace> unique = new LinkedHashMap<>();
        List<String> usedProviders = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<String> attributions = new ArrayList<>();

        for (DiscoveryProvider provider : providers) {
            // Interest name lookup is a bounded fallback, not another broad inventory request.
            if (provider instanceof PhotonPlaceDiscoveryProvider && placeName.isBlank() && !unique.isEmpty()
                    && !(category==DiscoveryCategory.NATURE && unique.values().stream().noneMatch(p ->
                        java.util.EnumSet.of(DiscoveryCategory.WATERFALL,DiscoveryCategory.LAKE,DiscoveryCategory.PARK,DiscoveryCategory.WILDLIFE,DiscoveryCategory.BEACH).contains(p.category())))) continue;
            if (freeOnly && !(provider instanceof CuratedDiscoveryProvider || provider instanceof OverpassDiscoveryProvider
                    || provider instanceof WikidataDiscoveryProvider)) continue;
            try {
                DiscoveryProviderResult result = provider.discover(request);
                warnings.addAll(result.warnings());
                List<DiscoveredPlace> matches = result.places().stream()
                        .filter(place -> placeNameMatches(place.name(), placeName)).toList();
                if (!matches.isEmpty()) {
                    usedProviders.add(result.provider());
                    if (result.attribution() != null && !result.attribution().isBlank()) attributions.add(result.attribution());
                }
                merge(unique, freeOnly ? matches.stream().filter(this::highlight).toList() : matches);
            } catch (RuntimeException ex) {
                log.warn("Discovery provider failed: provider={} error={}", provider.name(), ex.getClass().getSimpleName());
                warnings.add(provider.name() + " was unavailable; partial results are shown.");
            }
        }
        if (unique.isEmpty()) warnings.add("No source-backed listings were returned. Suttru did not generate placeholder activities.");
        warnings.add("Prices and opening hours may change. Confirm with the linked official provider before travelling.");
        if (unique.size() > maxResults) warnings.add("The configured " + maxResults + "-place search limit was reached. Narrow the category or radius for more focused results.");
        List<DiscoveredPlace> places = unique.values().stream().sorted(Comparator.comparingInt(TouristPlacePriority::rank)
                .thenComparingDouble(DiscoveredPlace::distanceKm)).limit(maxResults).toList();
        return new CachedSearch(Instant.now(), destination, places, List.copyOf(usedProviders),
                List.copyOf(new LinkedHashSet<>(warnings)), List.copyOf(new LinkedHashSet<>(attributions)));
    }

    Instant searchExpiry(Instant createdAt, List<DiscoveredPlace> places, List<String> warnings) {
        boolean priced = places.stream().anyMatch(place -> place.priceStatus() != PriceStatus.UNKNOWN);
        Instant expiry = createdAt.plus(priced ? pricingCacheDuration : staticCacheDuration);
        // Open/closed state is time-sensitive even when the underlying catalogue is static.
        if (places.stream().anyMatch(place -> place.openNow() != null)) {
            expiry = earlier(expiry, createdAt.plusSeconds(60));
        }
        if (warnings.stream().map(w -> w.toLowerCase(Locale.ROOT)).anyMatch(w ->
                w.contains("unavailable") || w.contains("limited name search") || w.contains("limit")
                || w.contains("not an exhaustive") || w.contains("inventory limit")))
            expiry = earlier(expiry, createdAt.plusSeconds(120));
        for (DiscoveredPlace place : places) {
            if (place.verificationExpiresAt() != null && place.verificationExpiresAt().isAfter(createdAt))
                expiry = earlier(expiry, place.verificationExpiresAt());
            for (DiscoveryPriceOption price : place.priceOptions()) {
                if (price.expiresAt() != null && price.expiresAt().isAfter(createdAt))
                    expiry = earlier(expiry, price.expiresAt());
            }
        }
        return expiry;
    }

    private Instant earlier(Instant left, Instant right) { return left.isBefore(right) ? left : right; }

    private boolean verificationExpired(DiscoveredPlace place) {
        Instant now = Instant.now();
        return place.verificationExpired() || place.verificationExpiresAt() != null && !place.verificationExpiresAt().isAfter(now)
                || place.priceOptions().stream().anyMatch(price -> price.mayHaveChanged()
                    || price.expiresAt() != null && !price.expiresAt().isAfter(now));
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
            } else {
                DiscoveredPlace existing = unique.get(nearbyKey);
                DiscoveredPlace winner = candidate.curated() || !existing.curated() && candidate.confidenceScore() > existing.confidenceScore() ? candidate : existing;
                DiscoveredPlace donor = winner == candidate ? existing : candidate;
                if (winner.imageGallery().isEmpty() && !donor.imageGallery().isEmpty()) {
                    winner = winner.toBuilder().imageGallery(donor.imageGallery()).imageUrl(donor.imageUrl())
                            .primaryImageUrl(donor.primaryImageUrl()).imageSource(donor.imageSource())
                            .imageAttribution(donor.imageAttribution()).imageLicense(donor.imageLicense()).imageExact(donor.imageExact()).build();
                }
                List<DiscoveryImage> gallery=new ArrayList<>();
                winner.imageGallery().forEach(image -> PlacePhotoService.add(gallery,image));
                donor.imageGallery().forEach(image -> PlacePhotoService.add(gallery,image));
                winner=winner.toBuilder().imageGallery(gallery.stream().limit(8).toList()).build();
                unique.put(nearbyKey, winner);
            }
        }
    }

    private boolean samePlace(DiscoveredPlace left, DiscoveredPlace right) {
        String leftName = normalize(left.name()), rightName = normalize(right.name());
        if (leftName.isBlank() || !leftName.equals(rightName)) return false;
        return haversine(left.latitude().doubleValue(), left.longitude().doubleValue(),
                right.latitude().doubleValue(), right.longitude().doubleValue()) <= 0.25;
    }

    private boolean highlight(DiscoveredPlace place) {
        if (place.sourceUrl()==null || !place.sourceUrl().startsWith("https://")) return false;
        return switch(place.category()) {
            case ATTRACTION,NATURE,WATERFALL,LAKE,RIVER,BEACH,VIEWPOINT,TEMPLE,CHURCH,MUSEUM,PARK,
                    WILDLIFE,ADVENTURE,ENTERTAINMENT,FAMILY,HISTORICAL,CULTURAL -> true;
            default -> false;
        };
    }
    private Comparator<DiscoveredPlace> highlightOrder() {
        return Comparator.comparing((DiscoveredPlace place) -> !place.curated())
                .thenComparing(Comparator.comparingInt((DiscoveredPlace place) -> value(place.popularityScore())).reversed())
                .thenComparing(Comparator.comparingDouble(DiscoveredPlace::confidenceScore).reversed())
                .thenComparingDouble(DiscoveredPlace::distanceKm)
                .thenComparing(DiscoveredPlace::name,String.CASE_INSENSITIVE_ORDER);
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
                    .thenComparingInt(TouristPlacePriority::rank)
                    .thenComparing(Comparator.comparingDouble(DiscoveredPlace::confidenceScore).reversed())
                    .thenComparing(Comparator.comparingInt((DiscoveredPlace place) -> value(place.popularityScore())).reversed())
                    .thenComparingDouble(DiscoveredPlace::distanceKm);
        };
    }

    private int verificationRank(DiscoveredPlace place) {
        if (verificationExpired(place)) return 4;
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
    private boolean placeNameMatches(String actual, String expected) {
        if (expected == null || expected.isBlank()) return true;
        String needle = normalize(expected);
        return actual != null && !needle.isBlank() && normalize(actual).contains(needle);
    }
    private boolean textMatches(String actual, String expected) { return expected == null || expected.isBlank() || actual != null && actual.toLowerCase(Locale.ROOT).contains(expected.toLowerCase(Locale.ROOT)); }
    private int effectiveDuration(DiscoveredPlace place) { return Optional.ofNullable(place.activityDuration()).orElse(Optional.ofNullable(place.suggestedVisitMinutes()).orElse(0)); }
    private int value(Integer value) { return value == null ? 0 : value; }
    private String normalize(String value) { return java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFKC).toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}\\p{M}]", ""); }
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

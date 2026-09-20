package com.tripmate.discovery.provider;

import com.tripmate.discovery.DiscoverySuggestion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.math.BigDecimal;

@Service
public class DestinationGeocodingService {
    private static final Logger log = LoggerFactory.getLogger(DestinationGeocodingService.class);
    private final List<GeocodingProvider> providers;
    private final Duration cacheDuration;
    private final Map<String, CachedDestination> cache = new ConcurrentHashMap<>();

    public DestinationGeocodingService(
            List<GeocodingProvider> providers,
            @Value("${discovery.geocode-cache-hours:24}") long cacheHours
    ) {
        this.providers = List.copyOf(providers);
        this.cacheDuration = Duration.ofHours(Math.max(1, cacheHours));
    }

    public GeocodedDestination geocode(String query) {
        String key = query.trim().toLowerCase(Locale.ROOT);
        CachedDestination cached = cache.get(key);
        if (cached != null && cached.createdAt().plus(cacheDuration).isAfter(Instant.now())) return cached.value();

        boolean answered = false;
        for (GeocodingProvider provider : providers) {
            try {
                var result = provider.geocode(query);
                answered = true;
                if (result.isPresent() && result.get().isIndia()) {
                    cache.put(key, new CachedDestination(Instant.now(), result.get()));
                    return result.get();
                }
            } catch (RestClientException ex) {
                log.warn("Geocoder failed: provider={} error={}", provider.name(), ex.getClass().getSimpleName());
            }
        }
        if (answered) throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Indian destination not found. Include the state, for example 'Kodaikanal, Tamil Nadu'.");
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Destination providers are temporarily unavailable. TripMate will not fabricate a location.");
    }

    public List<DiscoverySuggestion> suggest(String query, int limit) {
        Map<String, DiscoverySuggestion> unique = new LinkedHashMap<>();
        for (GeocodingProvider provider : providers) {
            try {
                for (DiscoverySuggestion suggestion : provider.suggest(query, limit)) {
                    String key = suggestion.label().toLowerCase(Locale.ROOT);
                    unique.putIfAbsent(key, suggestion);
                    if (unique.size() >= limit) return List.copyOf(unique.values());
                }
            } catch (RestClientException ex) {
                log.warn("Suggestion provider failed: provider={}", provider.name());
            }
        }
        return List.copyOf(unique.values());
    }

    public GeocodedDestination reverse(BigDecimal latitude, BigDecimal longitude) {
        if (latitude == null || longitude == null || latitude.doubleValue() < 6 || latitude.doubleValue() > 37.5
                || longitude.doubleValue() < 68 || longitude.doubleValue() > 97.5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordinates must be located in India");
        }
        for (GeocodingProvider provider : providers) {
            try {
                var result = provider.reverse(latitude, longitude);
                if (result.isPresent()) return result.get();
            } catch (RestClientException ex) {
                log.warn("Reverse geocoder failed: provider={}", provider.name());
            }
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No Indian destination was found for these coordinates");
    }

    private record CachedDestination(Instant createdAt, GeocodedDestination value) {
    }
}

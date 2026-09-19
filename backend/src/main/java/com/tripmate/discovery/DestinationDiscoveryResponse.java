package com.tripmate.discovery;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record DestinationDiscoveryResponse(
        String query,
        String resolvedDestination,
        BigDecimal latitude,
        BigDecimal longitude,
        int radiusKm,
        String category,
        String provider,
        String attribution,
        int resultCount,
        List<DiscoveredPlace> places,
        List<String> providersUsed,
        List<String> warnings,
        Instant lastUpdatedAt,
        int page,
        int size,
        int totalPages
) {
    public DestinationDiscoveryResponse {
        places = places == null ? List.of() : List.copyOf(places);
        providersUsed = providersUsed == null ? List.of() : List.copyOf(providersUsed);
        warnings = warnings == null ? List.of() : List.copyOf(warnings);
    }
}

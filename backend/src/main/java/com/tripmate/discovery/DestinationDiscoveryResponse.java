package com.tripmate.discovery;

import java.math.BigDecimal;
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
        List<DiscoveredPlace> places
) {
}

package com.tripmate.discovery.provider;

import com.tripmate.discovery.DiscoveryCategory;

public record DiscoveryProviderRequest(
        String query,
        GeocodedDestination destination,
        int radiusKm,
        DiscoveryCategory category
) {
}

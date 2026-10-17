package com.tripmate.discovery.provider;

import com.tripmate.discovery.DiscoveryCategory;

public record DiscoveryProviderRequest(
        String query,
        GeocodedDestination destination,
        int radiusKm,
        DiscoveryCategory category,
        String placeName
) {
    public DiscoveryProviderRequest(String query, GeocodedDestination destination, int radiusKm, DiscoveryCategory category) {
        this(query, destination, radiusKm, category, null);
    }
}

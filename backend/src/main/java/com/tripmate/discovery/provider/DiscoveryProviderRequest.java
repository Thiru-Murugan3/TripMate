package com.tripmate.discovery.provider;

import com.tripmate.discovery.DiscoveryCategory;

public record DiscoveryProviderRequest(
        String query,
        GeocodedDestination destination,
        int radiusKm,
        DiscoveryCategory category,
        String placeName,
        boolean fast
) {
    public DiscoveryProviderRequest(String query, GeocodedDestination destination, int radiusKm, DiscoveryCategory category, String placeName) {
        this(query,destination,radiusKm,category,placeName,false);
    }
    public DiscoveryProviderRequest(String query, GeocodedDestination destination, int radiusKm, DiscoveryCategory category) {
        this(query, destination, radiusKm, category, null, false);
    }
}

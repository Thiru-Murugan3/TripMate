package com.tripmate.discovery.provider;

import com.tripmate.discovery.DiscoveredPlace;

import java.util.List;

public record DiscoveryProviderResult(
        String provider,
        String attribution,
        List<DiscoveredPlace> places,
        List<String> warnings
) {
    public DiscoveryProviderResult {
        places = places == null ? List.of() : List.copyOf(places);
        warnings = warnings == null ? List.of() : List.copyOf(warnings);
    }
}

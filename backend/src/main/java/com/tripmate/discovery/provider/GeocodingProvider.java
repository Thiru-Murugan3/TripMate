package com.tripmate.discovery.provider;

import com.tripmate.discovery.DiscoverySuggestion;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;

public interface GeocodingProvider {
    String name();
    Optional<GeocodedDestination> geocode(String query);
    List<DiscoverySuggestion> suggest(String query, int limit);
    default Optional<GeocodedDestination> reverse(BigDecimal latitude, BigDecimal longitude) { return Optional.empty(); }
}

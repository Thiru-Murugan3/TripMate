package com.tripmate.discovery.provider;

import java.math.BigDecimal;

public record GeocodedDestination(
        BigDecimal latitude,
        BigDecimal longitude,
        String displayName,
        String city,
        String district,
        String state,
        String countryCode,
        String provider
) {
    public boolean isIndia() {
        return "IN".equalsIgnoreCase(countryCode) || displayName.toLowerCase().contains("india");
    }
}

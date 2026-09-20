package com.tripmate.discovery;

import java.math.BigDecimal;

public record DiscoverySuggestion(
        String label,
        String city,
        String district,
        String state,
        BigDecimal latitude,
        BigDecimal longitude,
        String provider
) {
}

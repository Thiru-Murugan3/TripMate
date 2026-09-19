package com.tripmate.discovery;

import com.tripmate.place.PlaceCategory;

import java.math.BigDecimal;

public record DiscoveredPlace(
        String externalId,
        String name,
        DiscoveryCategory category,
        BigDecimal latitude,
        BigDecimal longitude,
        double distanceKm,
        Integer suggestedVisitMinutes,
        String description,
        String imageUrl,
        String openingHours,
        String website,
        PlaceCategory saveCategory,
        BigDecimal estimatedCostPerPerson,
        String activityType
) {
}

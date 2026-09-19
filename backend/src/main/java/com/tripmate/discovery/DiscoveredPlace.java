package com.tripmate.discovery;

import com.tripmate.place.PlaceCategory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

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
        String activityType,
        DiscoveryItemType itemType,
        String address,
        String mapUrl,
        PriceStatus priceStatus,
        PriceType priceType,
        String currency,
        List<DiscoveryPriceOption> priceOptions,
        String sourceName,
        String sourceUrl,
        Instant sourceLastCheckedAt,
        double confidenceScore,
        String imageSource,
        String imageAttribution,
        String imageLicense,
        boolean imageExact,
        String bestTimeToVisit,
        String safetyInformation
) {
    public DiscoveredPlace(
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
        this(
                externalId,
                name,
                category,
                latitude,
                longitude,
                distanceKm,
                suggestedVisitMinutes,
                description,
                imageUrl,
                openingHours,
                website,
                saveCategory,
                estimatedCostPerPerson,
                activityType,
                defaultItemType(category),
                null,
                mapUrl(latitude, longitude),
                defaultPriceStatus(estimatedCostPerPerson),
                PriceType.UNKNOWN,
                "INR",
                List.of(),
                "Legacy curated data",
                website,
                null,
                0.25,
                null,
                null,
                null,
                false,
                null,
                null
        );
    }

    public DiscoveredPlace {
        priceOptions = priceOptions == null ? List.of() : List.copyOf(priceOptions);
        currency = currency == null || currency.isBlank() ? "INR" : currency;
        priceStatus = priceStatus == null ? PriceStatus.UNKNOWN : priceStatus;
        priceType = priceType == null ? PriceType.UNKNOWN : priceType;
        itemType = itemType == null ? defaultItemType(category) : itemType;
    }

    private static DiscoveryItemType defaultItemType(DiscoveryCategory category) {
        if (category == DiscoveryCategory.ADVENTURE || category == DiscoveryCategory.ENTERTAINMENT) {
            return DiscoveryItemType.ACTIVITY;
        }
        if (category == DiscoveryCategory.FOOD) {
            return DiscoveryItemType.FOOD;
        }
        if (category == DiscoveryCategory.STAY) {
            return DiscoveryItemType.STAY;
        }
        if (category == DiscoveryCategory.EVENT) {
            return DiscoveryItemType.EVENT;
        }
        return DiscoveryItemType.PLACE;
    }

    private static PriceStatus defaultPriceStatus(BigDecimal amount) {
        if (amount == null) {
            return PriceStatus.UNKNOWN;
        }
        return amount.compareTo(BigDecimal.ZERO) == 0
                ? PriceStatus.FREE
                : PriceStatus.ESTIMATED;
    }

    private static String mapUrl(BigDecimal latitude, BigDecimal longitude) {
        if (latitude == null || longitude == null) {
            return null;
        }
        return "https://www.google.com/maps/dir/?api=1&destination="
                + latitude.toPlainString() + "," + longitude.toPlainString();
    }
}

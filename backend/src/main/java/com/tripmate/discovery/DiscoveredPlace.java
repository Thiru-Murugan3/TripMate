package com.tripmate.discovery;

import com.tripmate.place.PlaceCategory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Canonical discovery contract. Legacy aliases remain so existing TripMate
 * clients can upgrade without a breaking API migration.
 */
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
        String slug,
        DiscoveryItemType itemType,
        String subcategory,
        String city,
        String district,
        String state,
        String fullAddress,
        String address,
        String shortDescription,
        String detailedDescription,
        String primaryImageUrl,
        List<DiscoveryImage> imageGallery,
        String imageSource,
        String imageAttribution,
        String imageLicense,
        boolean imageExact,
        String bestTimeToVisit,
        Integer activityDuration,
        Integer minimumAge,
        Integer maximumAge,
        BigDecimal minimumWeight,
        BigDecimal maximumWeight,
        String difficultyLevel,
        String safetyInformation,
        List<String> inclusions,
        List<String> exclusions,
        List<String> thingsToCarry,
        String accessibilityInformation,
        String contactPhone,
        String officialWebsite,
        String bookingUrl,
        String cancellationInformation,
        String mapUrl,
        PriceStatus priceStatus,
        PriceType priceType,
        String currency,
        List<DiscoveryPriceOption> priceOptions,
        String sourceName,
        String sourceUrl,
        Instant sourceLastCheckedAt,
        Instant verificationExpiresAt,
        boolean verificationExpired,
        double confidenceScore,
        Double rating,
        Integer ratingCount,
        Integer popularityScore,
        Boolean familyFriendly,
        Boolean openNow,
        boolean curated
) {
    public DiscoveredPlace {
        priceOptions = priceOptions == null ? List.of() : List.copyOf(priceOptions);
        imageGallery = imageGallery == null ? List.of() : List.copyOf(imageGallery);
        inclusions = inclusions == null ? List.of() : List.copyOf(inclusions);
        exclusions = exclusions == null ? List.of() : List.copyOf(exclusions);
        thingsToCarry = thingsToCarry == null ? List.of() : List.copyOf(thingsToCarry);
        currency = currency == null || currency.isBlank() ? "INR" : currency;
        priceStatus = priceStatus == null ? PriceStatus.UNKNOWN : priceStatus;
        priceType = priceType == null ? PriceType.UNKNOWN : priceType;
        itemType = itemType == null ? defaultItemType(category) : itemType;
        slug = slug == null || slug.isBlank() ? slugify(name) : slug;
        fullAddress = firstNonBlank(fullAddress, address);
        address = firstNonBlank(address, fullAddress);
        shortDescription = firstNonBlank(shortDescription, description);
        description = firstNonBlank(description, shortDescription);
        detailedDescription = firstNonBlank(detailedDescription, description);
        primaryImageUrl = firstNonBlank(primaryImageUrl, imageUrl);
        imageUrl = firstNonBlank(imageUrl, primaryImageUrl);
        officialWebsite = firstNonBlank(officialWebsite, website);
        website = firstNonBlank(website, officialWebsite);
        activityDuration = activityDuration == null ? suggestedVisitMinutes : activityDuration;
    }

    public DiscoveredPlace(
            String externalId, String name, DiscoveryCategory category, BigDecimal latitude,
            BigDecimal longitude, double distanceKm, Integer suggestedVisitMinutes,
            String description, String imageUrl, String openingHours, String website,
            PlaceCategory saveCategory, BigDecimal estimatedCostPerPerson, String activityType
    ) {
        this(
                externalId, name, category, latitude, longitude, distanceKm, suggestedVisitMinutes,
                description, imageUrl, openingHours, website, saveCategory, estimatedCostPerPerson,
                activityType, slugify(name), defaultItemType(category), null, null, null, null,
                null, null, description, description, imageUrl, List.of(), null, null, null, false,
                null, suggestedVisitMinutes, null, null, null, null, null, null, List.of(), List.of(),
                List.of(), null, null, website, null, null, mapUrl(latitude, longitude),
                defaultPriceStatus(estimatedCostPerPerson), PriceType.UNKNOWN, "INR", List.of(),
                "Legacy discovery data", website, null, null, false, 0.25, null, null, 0, null, null, false
        );
    }

    private static DiscoveryItemType defaultItemType(DiscoveryCategory category) {
        if (category == DiscoveryCategory.ADVENTURE || category == DiscoveryCategory.ENTERTAINMENT
                || category == DiscoveryCategory.FAMILY) return DiscoveryItemType.ACTIVITY;
        if (category == DiscoveryCategory.FOOD) return DiscoveryItemType.FOOD;
        if (category == DiscoveryCategory.STAY) return DiscoveryItemType.STAY;
        if (category == DiscoveryCategory.EVENT || category == DiscoveryCategory.CULTURAL) return DiscoveryItemType.EVENT;
        if (category == DiscoveryCategory.TRANSPORT) return DiscoveryItemType.TOUR_SERVICE;
        return DiscoveryItemType.PLACE;
    }

    private static PriceStatus defaultPriceStatus(BigDecimal amount) {
        if (amount == null) return PriceStatus.UNKNOWN;
        return amount.signum() == 0 ? PriceStatus.FREE : PriceStatus.ESTIMATED;
    }

    private static String slugify(String value) {
        if (value == null || value.isBlank()) return "discovery-item";
        String slug = value.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return slug.isBlank() ? "discovery-item" : slug;
    }

    private static String firstNonBlank(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }

    private static String mapUrl(BigDecimal latitude, BigDecimal longitude) {
        if (latitude == null || longitude == null) return null;
        return "https://www.google.com/maps/dir/?api=1&destination="
                + latitude.toPlainString() + "," + longitude.toPlainString();
    }
}

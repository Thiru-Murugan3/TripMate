package com.tripmate.discovery.curated;

import com.tripmate.discovery.*;
import com.tripmate.place.PlaceCategory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Component
public class CuratedDiscoveryMapper {
    public DiscoveredPlace toDiscoveredPlace(CuratedDiscoveryItem item, double distanceKm, Boolean openNow) {
        List<DiscoveryImage> images = item.getImages().stream().map(image -> new DiscoveryImage(
                image.getImageUrl(), image.getSourcePage(), image.getSourceName(), image.getAuthorName(),
                image.getLicenseName(), image.getAttribution(), image.isExactImage(), image.isPrimaryImage()
        )).toList();
        DiscoveryImage primary = images.stream().filter(DiscoveryImage::primary).findFirst()
                .orElse(images.isEmpty() ? null : images.getFirst());
        Instant now = Instant.now();
        List<DiscoveryPriceOption> prices = item.getPrices().stream().map(price -> new DiscoveryPriceOption(
                price.getLabel(), price.getAmount(), price.getMaximumAmount(), price.getPriceType(),
                price.getCurrency(), price.getSourceUrl(), price.getLastVerifiedAt(), price.getPriceStatus(),
                price.getExpiresAt(), price.getExpiresAt() != null && price.getExpiresAt().isBefore(now)
        )).toList();
        boolean expired = item.getVerificationExpiresAt() != null && item.getVerificationExpiresAt().isBefore(now);

        return new DiscoveredPlace(
                item.getExternalId(), item.getName(), item.getCategory(), item.getLatitude(), item.getLongitude(),
                Math.round(distanceKm * 10.0) / 10.0, item.getSuggestedVisitMinutes(), item.getShortDescription(),
                primary == null ? null : primary.url(), item.getOpeningHours(), item.getOfficialWebsite(),
                savedCategory(item.getCategory()), item.getBasePrice(), item.getSubcategory(), item.getSlug(),
                item.getItemType(), item.getSubcategory(), item.getCity(), item.getDistrict(), item.getState(),
                item.getFullAddress(), item.getFullAddress(), item.getShortDescription(), item.getDetailedDescription(),
                primary == null ? null : primary.url(), images, primary == null ? null : primary.sourceName(),
                primary == null ? null : primary.attribution(), primary == null ? null : primary.license(),
                primary != null && primary.exact(), item.getBestTimeToVisit(), item.getActivityDuration(),
                item.getMinimumAge(), item.getMaximumAge(), item.getMinimumWeight(), item.getMaximumWeight(),
                item.getDifficultyLevel(), item.getSafetyInformation(), lines(item.getInclusions()),
                lines(item.getExclusions()), lines(item.getThingsToCarry()), item.getAccessibilityInformation(),
                item.getContactPhone(), item.getOfficialWebsite(), item.getBookingUrl(),
                item.getCancellationInformation(), mapUrl(item), item.getPriceStatus(), item.getPriceType(),
                item.getCurrency(), prices, item.getSourceName(), item.getSourceUrl(), item.getSourceLastCheckedAt(),
                item.getVerificationExpiresAt(), expired, item.getConfidenceScore().doubleValue(),
                item.getRating() == null ? null : item.getRating().doubleValue(), item.getRatingCount(),
                item.getPopularityScore(), item.getFamilyFriendly(), openNow, true
        );
    }

    private List<String> lines(String text) {
        if (text == null || text.isBlank()) return List.of();
        return Arrays.stream(text.split("\\r?\\n")).map(String::trim).filter(value -> !value.isBlank()).toList();
    }

    private PlaceCategory savedCategory(DiscoveryCategory category) {
        return switch (category) {
            case FOOD -> PlaceCategory.RESTAURANT;
            case SHOPPING -> PlaceCategory.SHOPPING;
            case STAY -> PlaceCategory.HOTEL;
            case ADVENTURE, ENTERTAINMENT, FAMILY, EVENT, CULTURAL, NIGHTLIFE, WELLNESS -> PlaceCategory.ACTIVITY;
            default -> PlaceCategory.ATTRACTION;
        };
    }

    private String mapUrl(CuratedDiscoveryItem item) {
        return "https://www.google.com/maps/dir/?api=1&destination="
                + item.getLatitude().toPlainString() + "," + item.getLongitude().toPlainString();
    }
}

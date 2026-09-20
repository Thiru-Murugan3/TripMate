package com.tripmate.discovery.curated;

import com.tripmate.discovery.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record UpsertDiscoveryItemRequest(
        String externalId,
        @NotBlank @Size(max = 220) String name,
        @NotNull DiscoveryItemType itemType,
        @NotNull DiscoveryCategory category,
        @Size(max = 100) String subcategory,
        @Size(max = 120) String city,
        @Size(max = 120) String district,
        @Size(max = 120) String state,
        @Size(max = 600) String fullAddress,
        @NotNull @DecimalMin("6.0") @DecimalMax("37.5") BigDecimal latitude,
        @NotNull @DecimalMin("68.0") @DecimalMax("97.5") BigDecimal longitude,
        String shortDescription,
        String detailedDescription,
        @Size(max = 500) String openingHours,
        @Positive Integer suggestedVisitMinutes,
        String bestTimeToVisit,
        @Positive Integer activityDuration,
        @PositiveOrZero Integer minimumAge,
        @Positive Integer maximumAge,
        @PositiveOrZero BigDecimal minimumWeight,
        @Positive BigDecimal maximumWeight,
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
        @NotNull PriceStatus priceStatus,
        @NotNull PriceType priceType,
        @NotBlank String currency,
        @PositiveOrZero BigDecimal basePrice,
        @NotBlank String sourceName,
        @NotBlank String sourceUrl,
        Instant sourceLastCheckedAt,
        Instant verificationExpiresAt,
        @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal confidenceScore,
        @DecimalMin("0.0") @DecimalMax("5.0") BigDecimal rating,
        @PositiveOrZero Integer ratingCount,
        @PositiveOrZero Integer popularityScore,
        Boolean familyFriendly,
        String conflictStatus,
        String conflictNotes,
        Boolean enabled,
        @Valid List<PriceRequest> priceOptions,
        @Valid List<ImageRequest> images
) {
    public record PriceRequest(
            @NotBlank String label,
            @NotNull @PositiveOrZero BigDecimal amount,
            @PositiveOrZero BigDecimal maximumAmount,
            @NotNull PriceType priceType,
            @NotBlank String currency,
            @NotNull PriceStatus priceStatus,
            @NotBlank String sourceUrl,
            Instant lastVerifiedAt,
            Instant expiresAt
    ) {
    }

    public record ImageRequest(
            @NotBlank String imageUrl,
            @NotBlank String sourcePage,
            @NotBlank String sourceName,
            String author,
            String license,
            String attribution,
            boolean exact,
            boolean primary
    ) {
    }
}

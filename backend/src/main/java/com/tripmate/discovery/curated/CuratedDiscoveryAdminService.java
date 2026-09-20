package com.tripmate.discovery.curated;

import com.tripmate.discovery.PriceStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class CuratedDiscoveryAdminService {
    private final CuratedDiscoveryRepository repository;
    private final CuratedDiscoveryMapper mapper;

    @Transactional(readOnly = true)
    public List<AdminDiscoveryItemResponse> findAll(Boolean missingPrice, Boolean missingImage, Boolean conflictsOnly) {
        return repository.findAll().stream()
                .filter(item -> !Boolean.TRUE.equals(missingPrice)
                        || item.getPriceStatus() == PriceStatus.UNKNOWN || item.getPrices().isEmpty())
                .filter(item -> !Boolean.TRUE.equals(missingImage) || item.getImages().isEmpty())
                .filter(item -> !Boolean.TRUE.equals(conflictsOnly)
                        || (item.getConflictStatus() != null && !item.getConflictStatus().isBlank()))
                .map(this::response)
                .toList();
    }

    @Transactional
    public AdminDiscoveryItemResponse create(UpsertDiscoveryItemRequest request, Long adminId) {
        CuratedDiscoveryItem item = new CuratedDiscoveryItem();
        item.setCreatedBy(adminId);
        apply(item, request, adminId);
        return response(repository.save(item));
    }

    @Transactional
    public AdminDiscoveryItemResponse update(Long id, UpsertDiscoveryItemRequest request, Long adminId) {
        CuratedDiscoveryItem item = get(id);
        apply(item, request, adminId);
        return response(repository.save(item));
    }

    @Transactional
    public AdminDiscoveryItemResponse verify(Long id, VerifyDiscoveryItemRequest request, Long adminId) {
        CuratedDiscoveryItem item = get(id);
        item.setSourceLastCheckedAt(request.verifiedAt());
        item.setVerificationExpiresAt(request.expiresAt());
        if (item.getBasePrice() != null && item.getPriceStatus() == PriceStatus.UNKNOWN) {
            item.setPriceStatus(PriceStatus.VERIFIED);
        }
        item.getPrices().forEach(price -> {
            price.setLastVerifiedAt(request.verifiedAt());
            price.setExpiresAt(request.expiresAt());
            if (price.getPriceStatus() == PriceStatus.UNKNOWN) price.setPriceStatus(PriceStatus.VERIFIED);
        });
        item.setConflictStatus(null);
        item.setConflictNotes(null);
        item.setUpdatedBy(adminId);
        return response(repository.save(item));
    }

    @Transactional
    public AdminDiscoveryItemResponse setEnabled(Long id, boolean enabled, Long adminId) {
        CuratedDiscoveryItem item = get(id);
        item.setEnabled(enabled);
        item.setUpdatedBy(adminId);
        return response(repository.save(item));
    }

    private void apply(CuratedDiscoveryItem item, UpsertDiscoveryItemRequest request, Long adminId) {
        validateRanges(request);
        item.setName(request.name().trim());
        item.setSlug(slugify(request.name()));
        item.setExternalId(nonBlank(request.externalId(), "curated:" + slugify(request.name()) + ":" + System.nanoTime()));
        item.setItemType(request.itemType());
        item.setCategory(request.category());
        item.setSubcategory(request.subcategory());
        item.setCity(request.city());
        item.setDistrict(request.district());
        item.setState(request.state());
        item.setFullAddress(request.fullAddress());
        item.setLatitude(request.latitude());
        item.setLongitude(request.longitude());
        item.setShortDescription(request.shortDescription());
        item.setDetailedDescription(request.detailedDescription());
        item.setOpeningHours(request.openingHours());
        item.setSuggestedVisitMinutes(request.suggestedVisitMinutes());
        item.setBestTimeToVisit(request.bestTimeToVisit());
        item.setActivityDuration(request.activityDuration());
        item.setMinimumAge(request.minimumAge());
        item.setMaximumAge(request.maximumAge());
        item.setMinimumWeight(request.minimumWeight());
        item.setMaximumWeight(request.maximumWeight());
        item.setDifficultyLevel(request.difficultyLevel());
        item.setSafetyInformation(request.safetyInformation());
        item.setInclusions(lines(request.inclusions()));
        item.setExclusions(lines(request.exclusions()));
        item.setThingsToCarry(lines(request.thingsToCarry()));
        item.setAccessibilityInformation(request.accessibilityInformation());
        item.setContactPhone(request.contactPhone());
        item.setOfficialWebsite(request.officialWebsite());
        item.setBookingUrl(request.bookingUrl());
        item.setCancellationInformation(request.cancellationInformation());
        item.setPriceStatus(request.priceStatus());
        item.setPriceType(request.priceType());
        item.setCurrency(nonBlank(request.currency(), "INR"));
        item.setBasePrice(request.basePrice());
        item.setSourceName(request.sourceName().trim());
        item.setSourceUrl(request.sourceUrl().trim());
        item.setSourceLastCheckedAt(request.sourceLastCheckedAt());
        item.setVerificationExpiresAt(request.verificationExpiresAt());
        item.setConfidenceScore(request.confidenceScore() == null ? new BigDecimal("0.900") : request.confidenceScore());
        item.setRating(request.rating());
        item.setRatingCount(request.ratingCount());
        item.setPopularityScore(request.popularityScore() == null ? 0 : request.popularityScore());
        item.setFamilyFriendly(request.familyFriendly());
        item.setConflictStatus(request.conflictStatus());
        item.setConflictNotes(request.conflictNotes());
        item.setEnabled(request.enabled() == null || request.enabled());
        item.setUpdatedBy(adminId);

        item.getPrices().clear();
        if (request.priceOptions() != null) {
            int order = 0;
            for (UpsertDiscoveryItemRequest.PriceRequest source : request.priceOptions()) {
                CuratedDiscoveryPrice price = new CuratedDiscoveryPrice();
                price.setItem(item);
                price.setLabel(source.label());
                price.setAmount(source.amount());
                price.setMaximumAmount(source.maximumAmount());
                price.setPriceType(source.priceType());
                price.setCurrency(nonBlank(source.currency(), item.getCurrency()));
                price.setPriceStatus(source.priceStatus());
                price.setSourceUrl(source.sourceUrl());
                price.setLastVerifiedAt(source.lastVerifiedAt());
                price.setExpiresAt(source.expiresAt());
                price.setDisplayOrder(order++);
                item.getPrices().add(price);
            }
        }

        item.getImages().clear();
        if (request.images() != null) {
            int order = 0;
            for (UpsertDiscoveryItemRequest.ImageRequest source : request.images()) {
                CuratedDiscoveryImage image = new CuratedDiscoveryImage();
                image.setItem(item);
                image.setImageUrl(source.imageUrl());
                image.setSourcePage(source.sourcePage());
                image.setSourceName(source.sourceName());
                image.setAuthorName(source.author());
                image.setLicenseName(source.license());
                image.setAttribution(source.attribution());
                image.setExactImage(source.exact());
                image.setPrimaryImage(source.primary());
                image.setDisplayOrder(order++);
                item.getImages().add(image);
            }
        }
    }

    private void validateRanges(UpsertDiscoveryItemRequest request) {
        if (request.minimumAge() != null && request.maximumAge() != null && request.minimumAge() > request.maximumAge()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Minimum age cannot exceed maximum age");
        }
        if (request.minimumWeight() != null && request.maximumWeight() != null
                && request.minimumWeight().compareTo(request.maximumWeight()) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Minimum weight cannot exceed maximum weight");
        }
        if (request.priceStatus() == PriceStatus.FREE && request.basePrice() != null && request.basePrice().signum() != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Free listings must use a zero base price");
        }
    }

    private CuratedDiscoveryItem get(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Discovery listing not found"));
    }

    private AdminDiscoveryItemResponse response(CuratedDiscoveryItem item) {
        return new AdminDiscoveryItemResponse(item.getId(), mapper.toDiscoveredPlace(item, 0, null), item.isEnabled(),
                item.getConflictStatus(), item.getConflictNotes(), item.getCreatedBy(), item.getUpdatedBy(),
                item.getCreatedAt(), item.getUpdatedAt());
    }

    private String lines(List<String> values) {
        return values == null ? null : String.join("\n", values.stream().filter(value -> value != null && !value.isBlank()).map(String::trim).toList());
    }

    private String slugify(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    private String nonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}

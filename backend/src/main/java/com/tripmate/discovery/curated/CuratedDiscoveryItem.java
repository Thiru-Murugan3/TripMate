package com.tripmate.discovery.curated;

import com.tripmate.discovery.DiscoveryCategory;
import com.tripmate.discovery.DiscoveryItemType;
import com.tripmate.discovery.PriceStatus;
import com.tripmate.discovery.PriceType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "discovery_items")
@Getter
@Setter
@NoArgsConstructor
public class CuratedDiscoveryItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "external_id", nullable = false, unique = true, length = 220) private String externalId;
    @Column(nullable = false, length = 220) private String name;
    @Column(nullable = false, length = 240) private String slug;
    @Enumerated(EnumType.STRING) @Column(name = "item_type", nullable = false, length = 30) private DiscoveryItemType itemType;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 40) private DiscoveryCategory category;
    @Column(length = 100) private String subcategory;
    @Column(length = 120) private String city;
    @Column(length = 120) private String district;
    @Column(length = 120) private String state;
    @Column(name = "full_address", length = 600) private String fullAddress;
    @Column(nullable = false, precision = 10, scale = 7) private BigDecimal latitude;
    @Column(nullable = false, precision = 10, scale = 7) private BigDecimal longitude;
    @Column(name = "short_description", columnDefinition = "TEXT") private String shortDescription;
    @Column(name = "detailed_description", columnDefinition = "LONGTEXT") private String detailedDescription;
    @Column(name = "opening_hours", length = 500) private String openingHours;
    @Column(name = "suggested_visit_minutes") private Integer suggestedVisitMinutes;
    @Column(name = "best_time_to_visit", length = 300) private String bestTimeToVisit;
    @Column(name = "activity_duration") private Integer activityDuration;
    @Column(name = "minimum_age") private Integer minimumAge;
    @Column(name = "maximum_age") private Integer maximumAge;
    @Column(name = "minimum_weight", precision = 7, scale = 2) private BigDecimal minimumWeight;
    @Column(name = "maximum_weight", precision = 7, scale = 2) private BigDecimal maximumWeight;
    @Column(name = "difficulty_level", length = 30) private String difficultyLevel;
    @Column(name = "safety_information", columnDefinition = "TEXT") private String safetyInformation;
    @Column(columnDefinition = "TEXT") private String inclusions;
    @Column(columnDefinition = "TEXT") private String exclusions;
    @Column(name = "things_to_carry", columnDefinition = "TEXT") private String thingsToCarry;
    @Column(name = "accessibility_information", columnDefinition = "TEXT") private String accessibilityInformation;
    @Column(name = "contact_phone", length = 40) private String contactPhone;
    @Column(name = "official_website", length = 700) private String officialWebsite;
    @Column(name = "booking_url", length = 700) private String bookingUrl;
    @Column(name = "cancellation_information", columnDefinition = "TEXT") private String cancellationInformation;
    @Enumerated(EnumType.STRING) @Column(name = "price_status", nullable = false, length = 30) private PriceStatus priceStatus = PriceStatus.UNKNOWN;
    @Enumerated(EnumType.STRING) @Column(name = "price_type", nullable = false, length = 30) private PriceType priceType = PriceType.UNKNOWN;
    @Column(nullable = false, length = 10) private String currency = "INR";
    @Column(name = "base_price", precision = 12, scale = 2) private BigDecimal basePrice;
    @Column(name = "source_name", nullable = false, length = 180) private String sourceName;
    @Column(name = "source_url", nullable = false, length = 700) private String sourceUrl;
    @Column(name = "source_last_checked_at") private Instant sourceLastCheckedAt;
    @Column(name = "verification_expires_at") private Instant verificationExpiresAt;
    @Column(name = "confidence_score", nullable = false, precision = 4, scale = 3) private BigDecimal confidenceScore = new BigDecimal("0.500");
    @Column(precision = 3, scale = 2) private BigDecimal rating;
    @Column(name = "rating_count") private Integer ratingCount;
    @Column(name = "popularity_score", nullable = false) private Integer popularityScore = 0;
    @Column(name = "family_friendly") private Boolean familyFriendly;
    @Column(name = "conflict_status", length = 40) private String conflictStatus;
    @Column(name = "conflict_notes", columnDefinition = "TEXT") private String conflictNotes;
    @Column(nullable = false) private boolean enabled = true;
    @Column(name = "created_by") private Long createdBy;
    @Column(name = "updated_by") private Long updatedBy;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    @OneToMany(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("displayOrder ASC, id ASC")
    private Set<CuratedDiscoveryPrice> prices = new LinkedHashSet<>();

    @OneToMany(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("primaryImage DESC, displayOrder ASC, id ASC")
    private Set<CuratedDiscoveryImage> images = new LinkedHashSet<>();
}

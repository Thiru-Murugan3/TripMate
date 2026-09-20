package com.tripmate.discovery.curated;

import com.tripmate.discovery.PriceStatus;
import com.tripmate.discovery.PriceType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "discovery_price_options")
@Getter @Setter @NoArgsConstructor
public class CuratedDiscoveryPrice {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "discovery_item_id") private CuratedDiscoveryItem item;
    @Column(nullable = false, length = 120) private String label;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;
    @Column(name = "maximum_amount", precision = 12, scale = 2) private BigDecimal maximumAmount;
    @Enumerated(EnumType.STRING) @Column(name = "price_type", nullable = false, length = 30) private PriceType priceType;
    @Column(nullable = false, length = 10) private String currency = "INR";
    @Enumerated(EnumType.STRING) @Column(name = "price_status", nullable = false, length = 30) private PriceStatus priceStatus;
    @Column(name = "source_url", nullable = false, length = 700) private String sourceUrl;
    @Column(name = "last_verified_at") private Instant lastVerifiedAt;
    @Column(name = "expires_at") private Instant expiresAt;
    @Column(name = "display_order", nullable = false) private int displayOrder;
}

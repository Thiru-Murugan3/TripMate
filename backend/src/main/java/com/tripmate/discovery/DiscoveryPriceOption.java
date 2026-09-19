package com.tripmate.discovery;

import java.math.BigDecimal;
import java.time.Instant;

public record DiscoveryPriceOption(
        String label,
        BigDecimal amount,
        BigDecimal maximumAmount,
        PriceType priceType,
        String currency,
        String sourceUrl,
        Instant lastVerifiedAt
) {
}

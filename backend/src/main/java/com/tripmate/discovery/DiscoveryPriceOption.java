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
        Instant lastVerifiedAt,
        PriceStatus status,
        Instant expiresAt,
        boolean mayHaveChanged
) {
    public DiscoveryPriceOption(
            String label,
            BigDecimal amount,
            BigDecimal maximumAmount,
            PriceType priceType,
            String currency,
            String sourceUrl,
            Instant lastVerifiedAt
    ) {
        this(label, amount, maximumAmount, priceType, currency, sourceUrl, lastVerifiedAt,
                PriceStatus.ESTIMATED, null, false);
    }
}

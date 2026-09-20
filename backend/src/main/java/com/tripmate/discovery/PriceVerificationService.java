package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PriceVerificationService {
    private static final Pattern FIRST_AMOUNT = Pattern.compile("(\\d+(?:\\.\\d{1,2})?)");
    private final Duration verificationTtl;

    public PriceVerificationService(@Value("${discovery.price-verification-days:30}") long days) {
        this.verificationTtl = Duration.ofDays(Math.max(1, days));
    }

    public VerifiedPrice fromOpenStreetMap(JsonNode tags, String sourceUrl, Instant checkedAt) {
        String fee = tags.path("fee").asText("").trim();
        String charge = firstNonBlank(tags.path("charge").asText(null), tags.path("fee:amount").asText(null));
        Instant expiresAt = checkedAt.plus(verificationTtl);

        if ("no".equalsIgnoreCase(fee) || "free".equalsIgnoreCase(fee)) {
            DiscoveryPriceOption option = new DiscoveryPriceOption("Entry", BigDecimal.ZERO.setScale(2), null,
                    PriceType.PER_PERSON, "INR", sourceUrl, checkedAt, PriceStatus.FREE, expiresAt, false);
            return new VerifiedPrice(BigDecimal.ZERO.setScale(2), PriceStatus.FREE, PriceType.PER_PERSON,
                    "INR", List.of(option), checkedAt, expiresAt, false);
        }

        BigDecimal amount = firstAmount(charge);
        if (amount != null) {
            PriceType type = priceTypeFromText(charge);
            DiscoveryPriceOption option = new DiscoveryPriceOption("Source-listed price", amount, null, type,
                    currencyFromText(charge), sourceUrl, checkedAt, PriceStatus.ESTIMATED, expiresAt, false);
            return new VerifiedPrice(amount, PriceStatus.ESTIMATED, type, currencyFromText(charge),
                    List.of(option), checkedAt, expiresAt, false);
        }
        return unknown();
    }

    public VerifiedPrice unknown() {
        return new VerifiedPrice(null, PriceStatus.UNKNOWN, PriceType.UNKNOWN, "INR", List.of(), null, null, false);
    }

    public boolean expired(Instant expiry) {
        return expiry != null && expiry.isBefore(Instant.now());
    }

    private BigDecimal firstAmount(String value) {
        if (value == null || value.isBlank()) return null;
        Matcher matcher = FIRST_AMOUNT.matcher(value.replace(",", ""));
        if (!matcher.find()) return null;
        try { return new BigDecimal(matcher.group(1)).setScale(2, RoundingMode.HALF_UP); }
        catch (NumberFormatException ex) { return null; }
    }

    private PriceType priceTypeFromText(String text) {
        String value = text == null ? "" : text.toLowerCase(Locale.ROOT);
        if (value.contains("vehicle") || value.contains("car")) return PriceType.PER_VEHICLE;
        if (value.contains("night") || value.contains("room")) return PriceType.PER_NIGHT;
        if (value.contains("activity") || value.contains("ride")) return PriceType.PER_ACTIVITY;
        if (value.contains("person") || value.contains("adult") || value.contains("child")) return PriceType.PER_PERSON;
        if (value.contains("-") || value.contains(" to ")) return PriceType.RANGE;
        return PriceType.UNKNOWN;
    }

    private String currencyFromText(String text) {
        if (text == null) return "INR";
        String value = text.toUpperCase(Locale.ROOT);
        return value.contains("USD") || value.contains("$") ? "USD" : "INR";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value.trim();
        return null;
    }

    public record VerifiedPrice(
            BigDecimal amount,
            PriceStatus status,
            PriceType type,
            String currency,
            List<DiscoveryPriceOption> options,
            Instant verifiedAt,
            Instant expiresAt,
            boolean expired
    ) {
    }
}

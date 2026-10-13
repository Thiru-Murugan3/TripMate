package com.tripmate.expense;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Recorded historical conversion. All balances and splits remain in INR. */
record ExpenseMoney(String currency, BigDecimal original, BigDecimal rate, BigDecimal amount) {
    private static final Set<String> CURRENCIES = Set.of("INR", "USD", "EUR", "GBP", "SGD", "AUD", "CAD", "AED");
    private static final BigDecimal MAX = new BigDecimal("9999999999.99");

    static ExpenseMoney resolve(BigDecimal amount, String currency, BigDecimal original, BigDecimal rate) {
        if (currency == null && original == null && rate == null) {
            currency = "INR"; original = amount; rate = BigDecimal.ONE;
        }
        if (currency == null || !CURRENCIES.contains(currency) || original == null || rate == null
                || original.signum() <= 0 || original.compareTo(MAX) > 0 || original.stripTrailingZeros().scale() > 2
                || rate.signum() <= 0 || rate.compareTo(new BigDecimal("9999999999")) > 0
                || rate.stripTrailingZeros().scale() > 8
                || (currency.equals("INR") && rate.compareTo(BigDecimal.ONE) != 0)) {
            throw bad("Provide a supported currency, positive amount (up to 2 decimals), and INR exchange rate (up to 8 decimals)");
        }
        BigDecimal converted = original.multiply(rate).setScale(2, RoundingMode.HALF_UP);
        if (converted.signum() <= 0 || converted.compareTo(MAX) > 0) throw bad("Converted INR amount is out of range");
        return new ExpenseMoney(currency, original.setScale(2), rate, converted);
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}

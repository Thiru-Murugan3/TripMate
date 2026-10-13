package com.tripmate.expense;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class ExpenseMoneyTest {
    private BigDecimal n(String value) { return new BigDecimal(value); }

    @Test void convertsFromRecordedRateAndIgnoresClientTotal() {
        var money = ExpenseMoney.resolve(n("1"), "USD", n("10.25"), n("83.12345678"));
        assertEquals(n("852.02"), money.amount());
        assertEquals(n("10.25"), money.original());
        assertEquals(n("83.12345678"), money.rate());
    }
    @Test void oldRequestsRemainInr() {
        var money = ExpenseMoney.resolve(n("42.50"), null, null, null);
        assertEquals("INR", money.currency());
        assertEquals(n("42.50"), money.amount());
        assertEquals(BigDecimal.ONE, money.rate());
    }
    @Test void validatesCurrencyPrecisionAndBounds() {
        assertThrows(ResponseStatusException.class, () -> ExpenseMoney.resolve(n("1"), "XYZ", n("1"), n("1")));
        assertThrows(ResponseStatusException.class, () -> ExpenseMoney.resolve(n("1"), "USD", n("1"), null));
        assertThrows(ResponseStatusException.class, () -> ExpenseMoney.resolve(n("1"), "USD", n("1"), n("0")));
        assertThrows(ResponseStatusException.class, () -> ExpenseMoney.resolve(n("1"), "INR", n("1"), n("2")));
        assertThrows(ResponseStatusException.class, () -> ExpenseMoney.resolve(n("1"), "USD", n("1.001"), n("1")));
        assertThrows(ResponseStatusException.class, () -> ExpenseMoney.resolve(n("1"), "USD", n("1"), n("1.000000001")));
        assertThrows(ResponseStatusException.class, () -> ExpenseMoney.resolve(n("1"), "USD", n("9999999999"), n("100")));
        assertThrows(ResponseStatusException.class, () -> ExpenseMoney.resolve(n("1"), "USD", n("0.01"), n("0.00001")));
    }
}

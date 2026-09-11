package com.tripmate.expense;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CreateExpenseSplitRequest(
        @NotNull(message = "User ID is required")
        Long userId,

        @NotNull(message = "Share amount is required")
        @DecimalMin(value = "0.01", message = "Share amount must be greater than 0")
        BigDecimal shareAmount,

        BigDecimal percentage
) {
}

package com.tripmate.expense;

import java.math.BigDecimal;

public record ExpenseSplitResponse(
        Long id,
        Long userId,
        String userName,
        BigDecimal shareAmount,
        BigDecimal percentage,
        SettlementStatus settlementStatus
) {
    public static ExpenseSplitResponse from(ExpenseSplit split) {
        return new ExpenseSplitResponse(
                split.getId(),
                split.getUser().getId(),
                split.getUser().getName(),
                split.getShareAmount(),
                split.getPercentage(),
                split.getSettlementStatus()
        );
    }
}

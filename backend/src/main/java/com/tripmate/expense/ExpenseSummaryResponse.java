package com.tripmate.expense;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record ExpenseSummaryResponse(
        Long tripId,
        BigDecimal totalTripBudget,
        BigDecimal totalExpenses,
        BigDecimal remainingBudget,
        Double budgetUtilizationPercentage,
        Map<ExpenseCategory, BigDecimal> categoryBreakdown,
        List<MemberBalance> memberBalances,
        List<SuggestedSettlement> suggestedSettlements
) {
    public record MemberBalance(
            Long userId,
            String userName,
            BigDecimal totalPaid,
            BigDecimal totalOwed,
            BigDecimal netBalance
    ) {
    }

    public record SuggestedSettlement(
            Long fromUserId,
            String fromUserName,
            Long toUserId,
            String toUserName,
            BigDecimal amount
    ) {
    }
}

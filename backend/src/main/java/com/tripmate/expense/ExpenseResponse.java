package com.tripmate.expense;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record ExpenseResponse(
        Long id,
        Long tripId,
        Long paidById,
        String paidByName,
        String title,
        BigDecimal amount,
        ExpenseCategory category,
        LocalDate expenseDate,
        SplitType splitType,
        String notes,
        List<ExpenseSplitResponse> splits,
        LocalDateTime createdAt
) {
    public static ExpenseResponse from(Expense expense) {
        return new ExpenseResponse(
                expense.getId(),
                expense.getTrip().getId(),
                expense.getPaidBy().getId(),
                expense.getPaidBy().getName(),
                expense.getTitle(),
                expense.getAmount(),
                expense.getCategory(),
                expense.getExpenseDate(),
                expense.getSplitType(),
                expense.getNotes(),
                expense.getSplits() != null
                        ? expense.getSplits().stream().map(ExpenseSplitResponse::from).toList()
                        : List.of(),
                expense.getCreatedAt()
        );
    }
}

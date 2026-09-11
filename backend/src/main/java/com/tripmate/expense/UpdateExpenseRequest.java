package com.tripmate.expense;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record UpdateExpenseRequest(

        @NotBlank(message = "Expense title is required")
        @Size(max = 180, message = "Title cannot exceed 180 characters")
        String title,

        @NotNull(message = "Amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
        BigDecimal amount,

        @NotNull(message = "Category is required")
        ExpenseCategory category,

        @NotNull(message = "Expense date is required")
        LocalDate expenseDate,

        Long paidById,

        SplitType splitType,

        List<CreateExpenseRequest.SplitDetail> splits,

        String notes
) {
}

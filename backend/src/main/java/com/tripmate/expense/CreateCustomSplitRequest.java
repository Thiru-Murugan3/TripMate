package com.tripmate.expense;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CreateCustomSplitRequest(
        @NotNull(message = "Split type is required")
        SplitType splitType,

        @NotEmpty(message = "Splits list cannot be empty")
        List<CreateExpenseSplitRequest> splits
) {
}

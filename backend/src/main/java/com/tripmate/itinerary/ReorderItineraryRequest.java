package com.tripmate.itinerary;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ReorderItineraryRequest(
        @NotEmpty(message = "Item orders list cannot be empty")
        List<ItemOrder> items
) {
    public record ItemOrder(
            @NotNull(message = "Item ID is required")
            Long itemId,

            @NotNull(message = "Display order is required")
            Integer displayOrder
    ) {
    }
}

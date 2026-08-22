package com.tripmate.place;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreatePlaceRequest(

        @NotBlank(message = "Place name is required")
        @Size(max = 180, message = "Place name cannot exceed 180 characters")
        String name,

        @NotNull(message = "Place category is required")
        PlaceCategory category,

        BigDecimal latitude,

        BigDecimal longitude,

        @DecimalMin(value = "0.0", inclusive = true, message = "Estimated cost cannot be negative")
        BigDecimal estimatedCost,

        String notes
) {
}

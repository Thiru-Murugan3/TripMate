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

        String notes,

        /** Optional area to look the place up in when no coordinates are sent (e.g. "Goa"). */
        @Size(max = 180, message = "Location hint cannot exceed 180 characters")
        String locationHint
) {
    /** Older clients send no hint. */
    public CreatePlaceRequest(String name, PlaceCategory category, BigDecimal latitude, BigDecimal longitude,
                              BigDecimal estimatedCost, String notes) {
        this(name, category, latitude, longitude, estimatedCost, notes, null);
    }
}

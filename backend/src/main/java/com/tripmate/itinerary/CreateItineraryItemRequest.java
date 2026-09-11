package com.tripmate.itinerary;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalTime;

public record CreateItineraryItemRequest(

        Long placeId,

        @NotBlank(message = "Activity title is required")
        @Size(max = 180, message = "Activity title cannot exceed 180 characters")
        String title,

        String description,

        LocalTime startTime,

        LocalTime endTime,

        @Size(max = 255, message = "Location cannot exceed 255 characters")
        String location,

        @DecimalMin(value = "0.0", inclusive = true, message = "Estimated cost cannot be negative")
        BigDecimal estimatedCost,

        Integer displayOrder
) {
}

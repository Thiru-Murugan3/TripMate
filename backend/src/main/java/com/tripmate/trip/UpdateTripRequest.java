package com.tripmate.trip;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record UpdateTripRequest(

        @NotBlank(message = "Trip name is required")
        @Size(max = 160, message = "Trip name cannot exceed 160 characters")
        String name,

        @NotBlank(message = "Destination is required")
        @Size(max = 180, message = "Destination cannot exceed 180 characters")
        String destination,

        @NotNull(message = "Trip type is required")
        TripType tripType,

        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "End date is required")
        LocalDate endDate,

        @Min(value = 1, message = "Traveler count must be at least 1")
        Integer travelerCount,

        @DecimalMin(value = "0.0", inclusive = true, message = "Budget cannot be negative")
        BigDecimal budget,

        String description,

        @Size(max = 500, message = "Cover image URL cannot exceed 500 characters")
        String coverImageUrl,

        TripStatus status
) {
}

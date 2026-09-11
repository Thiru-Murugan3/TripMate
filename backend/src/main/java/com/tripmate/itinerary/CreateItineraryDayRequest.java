package com.tripmate.itinerary;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateItineraryDayRequest(

        @NotNull(message = "Day number is required")
        @Min(value = 1, message = "Day number must be at least 1")
        Integer dayNumber,

        LocalDate dayDate,

        @Size(max = 180, message = "Title cannot exceed 180 characters")
        String title,

        String notes
) {
}

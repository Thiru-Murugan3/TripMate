package com.tripmate.booking;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record SearchBookingRequest(
        @NotNull(message = "Booking type is required")
        BookingType bookingType,

        TransportType transportType,

        @Size(max = 180, message = "Origin cannot exceed 180 characters")
        String origin,

        @Size(max = 180, message = "Destination cannot exceed 180 characters")
        String destination,

        @NotNull(message = "Start date is required")
        LocalDate startDate,

        LocalDate endDate,

        @Min(value = 1, message = "Travelers must be at least 1")
        @Max(value = 9, message = "Travelers cannot exceed 9")
        Integer travelers
) {
}

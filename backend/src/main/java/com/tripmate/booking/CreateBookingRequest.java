package com.tripmate.booking;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CreateBookingRequest(

        @NotNull(message = "Booking type is required")
        BookingType bookingType,

        TransportType transportType,

        @NotBlank(message = "Provider name is required")
        @Size(max = 180, message = "Provider name cannot exceed 180 characters")
        String providerName,

        @Size(max = 120, message = "Booking reference cannot exceed 120 characters")
        String bookingReference,

        @Size(max = 180, message = "Departure location cannot exceed 180 characters")
        String departure,

        @Size(max = 180, message = "Arrival location cannot exceed 180 characters")
        String arrival,

        LocalDateTime startDatetime,

        LocalDateTime endDatetime,

        @DecimalMin(value = "0.0", inclusive = true, message = "Amount cannot be negative")
        BigDecimal amount,

        BookingStatus status,

        String notes
) {
}

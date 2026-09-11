package com.tripmate.booking;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record BookingResponse(
        Long id,
        Long tripId,
        BookingType bookingType,
        String providerName,
        String bookingReference,
        LocalDateTime startDatetime,
        LocalDateTime endDatetime,
        BigDecimal amount,
        BookingStatus status,
        String notes
) {
    public static BookingResponse from(Booking booking) {
        return new BookingResponse(
                booking.getId(),
                booking.getTrip().getId(),
                booking.getBookingType(),
                booking.getProviderName(),
                booking.getBookingReference(),
                booking.getStartDatetime(),
                booking.getEndDatetime(),
                booking.getAmount(),
                booking.getStatus(),
                booking.getNotes()
        );
    }
}

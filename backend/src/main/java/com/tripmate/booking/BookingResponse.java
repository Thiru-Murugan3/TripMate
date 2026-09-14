package com.tripmate.booking;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record BookingResponse(
        Long id,
        Long tripId,
        BookingType bookingType,
        TransportType transportType,
        String providerName,
        String bookingReference,
        String departure,
        String arrival,
        LocalDateTime startDatetime,
        LocalDateTime endDatetime,
        BigDecimal amount,
        BookingStatus status,
        String notes,
        BookingSource bookingSource,
        PaymentStatus paymentStatus,
        String currency,
        Boolean refundable,
        String cancellationReason,
        LocalDateTime cancelledAt,
        String travelerName,
        List<BookingTravelerResponse> travelers
) {
    public static BookingResponse from(Booking booking) {
        return new BookingResponse(
                booking.getId(),
                booking.getTrip().getId(),
                booking.getBookingType(),
                booking.getTransportType(),
                booking.getProviderName(),
                booking.getBookingReference(),
                booking.getDeparture(),
                booking.getArrival(),
                booking.getStartDatetime(),
                booking.getEndDatetime(),
                booking.getAmount(),
                booking.getStatus(),
                booking.getNotes(),
                booking.getBookingSource(),
                booking.getPaymentStatus(),
                booking.getCurrency(),
                booking.getRefundable(),
                booking.getCancellationReason(),
                booking.getCancelledAt(),
                booking.getTravelerName(),
                booking.getTravelers() == null
                        ? List.of()
                        : booking.getTravelers().stream().map(BookingTravelerResponse::from).toList()
        );
    }
}

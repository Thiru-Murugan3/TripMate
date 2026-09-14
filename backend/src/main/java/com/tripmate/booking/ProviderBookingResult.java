package com.tripmate.booking;

public record ProviderBookingResult(
        BookingOfferResponse offer,
        String bookingReference,
        PaymentStatus paymentStatus,
        String message
) {
}

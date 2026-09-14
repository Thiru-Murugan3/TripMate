package com.tripmate.booking;

public record BookNowResponse(
        BookingResponse booking,
        String providerMode,
        boolean liveBookingEnabled,
        PaymentStatus paymentStatus,
        String message
) {
}

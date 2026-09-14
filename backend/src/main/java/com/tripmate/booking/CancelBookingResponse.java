package com.tripmate.booking;

public record CancelBookingResponse(
        BookingResponse booking,
        String message
) {
}

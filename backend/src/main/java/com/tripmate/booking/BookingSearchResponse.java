package com.tripmate.booking;

import java.util.List;

public record BookingSearchResponse(
        String providerMode,
        boolean liveBookingEnabled,
        String disclaimer,
        List<BookingOfferResponse> offers
) {
}

package com.tripmate.booking;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record BookingOfferResponse(
        String offerId,
        BookingType bookingType,
        TransportType transportType,
        String providerName,
        String title,
        String departure,
        String arrival,
        LocalDateTime startDatetime,
        LocalDateTime endDatetime,
        BigDecimal amount,
        String currency,
        boolean refundable
) {
}

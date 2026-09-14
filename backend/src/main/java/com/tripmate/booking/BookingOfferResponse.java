package com.tripmate.booking;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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
        boolean refundable,
        Integer durationMinutes,
        Integer stops,
        String serviceClass,
        Integer availableSeats,
        List<String> amenities
) {
}

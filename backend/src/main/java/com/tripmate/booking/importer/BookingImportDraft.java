package com.tripmate.booking.importer;

import com.tripmate.booking.BookingType;
import com.tripmate.booking.TransportType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record BookingImportDraft(
        BookingType bookingType,
        TransportType transportType,
        String providerName,
        String bookingReference,
        String departure,
        String arrival,
        LocalDateTime startDatetime,
        LocalDateTime endDatetime,
        BigDecimal amount,
        String currency,
        double confidence,
        List<String> warnings,
        String extractedText
) {}

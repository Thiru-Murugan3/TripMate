package com.tripmate.booking.email;

import com.tripmate.booking.importer.BookingImportDraft;

import java.time.LocalDateTime;

public record ReservationEmailImportResponse(
        Long id,
        String senderAddress,
        String recipientAddress,
        String subject,
        int attachmentCount,
        ReservationEmailImportStatus status,
        String errorMessage,
        LocalDateTime receivedAt,
        Long tripId,
        Long bookingId,
        BookingImportDraft draft
) {
}

package com.tripmate.booking.email;

public record ReservationImportAddressResponse(
        String forwardingAddress,
        boolean receivingConfigured,
        String setupMessage
) {
}

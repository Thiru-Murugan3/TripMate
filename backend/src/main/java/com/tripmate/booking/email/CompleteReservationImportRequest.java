package com.tripmate.booking.email;

import jakarta.validation.constraints.NotNull;

public record CompleteReservationImportRequest(
        @NotNull Long tripId,
        @NotNull Long bookingId
) {
}

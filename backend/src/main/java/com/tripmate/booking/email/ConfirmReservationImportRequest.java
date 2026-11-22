package com.tripmate.booking.email;
import com.tripmate.booking.CreateBookingRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
public record ConfirmReservationImportRequest(@NotNull Long tripId,
        @NotNull @Valid CreateBookingRequest booking) {}

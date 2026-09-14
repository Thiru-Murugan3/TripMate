package com.tripmate.booking;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record BookNowRequest(
        @NotBlank(message = "Offer ID is required")
        String offerId,

        @NotEmpty(message = "At least one traveler is required")
        @Size(max = 9, message = "A maximum of 9 travelers can be booked at once")
        List<@Valid BookingTravelerRequest> travelers,

        @NotBlank(message = "Payment method is required")
        String paymentMethod
) {
}

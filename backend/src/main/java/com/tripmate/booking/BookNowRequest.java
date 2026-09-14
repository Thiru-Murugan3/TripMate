package com.tripmate.booking;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BookNowRequest(
        @NotBlank(message = "Offer ID is required")
        String offerId,

        @NotBlank(message = "Traveler name is required")
        @Size(max = 120, message = "Traveler name cannot exceed 120 characters")
        String travelerName,

        @NotBlank(message = "Traveler email is required")
        @Email(message = "Traveler email must be valid")
        @Size(max = 180, message = "Traveler email cannot exceed 180 characters")
        String travelerEmail,

        @Size(max = 20, message = "Traveler mobile cannot exceed 20 characters")
        String travelerMobile,

        @NotBlank(message = "Payment method is required")
        String paymentMethod
) {
}

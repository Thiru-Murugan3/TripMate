package com.tripmate.booking;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record BookingTravelerRequest(
        @NotBlank(message = "Traveler full name is required")
        @Size(max = 120, message = "Traveler name cannot exceed 120 characters")
        String fullName,

        @NotNull(message = "Traveler gender is required")
        BookingTravelerGender gender,

        @NotNull(message = "Traveler date of birth is required")
        @Past(message = "Traveler date of birth must be in the past")
        LocalDate dateOfBirth,

        @Email(message = "Traveler email must be valid")
        @Size(max = 180, message = "Traveler email cannot exceed 180 characters")
        String email,

        @Size(max = 20, message = "Traveler mobile cannot exceed 20 characters")
        String mobile
) {
}

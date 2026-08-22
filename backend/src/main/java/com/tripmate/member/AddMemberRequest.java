package com.tripmate.member;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AddMemberRequest(

        @NotBlank(message = "User email is required")
        @Email(message = "Please provide a valid email address")
        String email,

        @NotNull(message = "Trip role is required")
        TripRole role
) {
}

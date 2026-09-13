package com.tripmate.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ResendEmailOtpRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Enter a valid email")
        String email
) {
}

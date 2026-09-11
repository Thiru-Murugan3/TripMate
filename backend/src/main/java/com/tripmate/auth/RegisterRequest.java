package com.tripmate.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(

        @NotBlank(message = "Name is required")
        @Size(max = 120, message = "Name cannot exceed 120 characters")
        String name,

        @NotBlank(message = "Email is required")
        @Email(message = "Enter a valid email")
        @Size(max = 180, message = "Email cannot exceed 180 characters")
        String email,

        @NotBlank(message = "Mobile number is required")
        @Pattern(
                regexp = "^[0-9]{10}$",
                message = "Mobile number must contain exactly 10 digits"
        )
        String mobile,

        @NotBlank(message = "Password is required")
        @Size(
                min = 8,
                max = 20,
                message = "Password must be at least 8 characters"
        )
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9])(?=\\S+$).{8,20}$",
                message = "Password must contain uppercase, lowercase, number and special character"
        )
        String password

) {
}

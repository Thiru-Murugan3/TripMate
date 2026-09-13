package com.tripmate.auth;

public record RegistrationPendingResponse(
        String message,
        String email,
        long expiresIn
) {
}

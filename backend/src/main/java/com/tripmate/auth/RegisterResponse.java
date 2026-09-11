package com.tripmate.auth;

public record RegisterResponse(
        Long id,
        String name,
        String email,
        String message
) {
}

package com.tripmate.auth;

public record RefreshResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn
) {
}

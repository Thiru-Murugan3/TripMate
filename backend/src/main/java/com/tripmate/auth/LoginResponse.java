package com.tripmate.auth;

public record LoginResponse(

        Long userId,
        String name,
        String email,
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn

) {
}

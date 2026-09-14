package com.tripmate.auth;

public record GoogleAuthConfigResponse(
        String clientId,
        boolean enabled
) {
}

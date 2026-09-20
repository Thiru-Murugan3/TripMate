package com.tripmate.discovery.curated;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record VerifyDiscoveryItemRequest(
        @NotNull Instant verifiedAt,
        @NotNull @Future Instant expiresAt
) {
}

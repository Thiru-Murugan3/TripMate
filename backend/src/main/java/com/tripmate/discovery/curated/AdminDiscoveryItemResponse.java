package com.tripmate.discovery.curated;

import com.tripmate.discovery.DiscoveredPlace;

import java.time.Instant;

public record AdminDiscoveryItemResponse(
        Long id,
        DiscoveredPlace listing,
        boolean enabled,
        String conflictStatus,
        String conflictNotes,
        Long createdBy,
        Long updatedBy,
        Instant createdAt,
        Instant updatedAt
) {
}

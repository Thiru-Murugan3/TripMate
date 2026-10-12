package com.tripmate.discovery;

import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExpiringCacheTest {
    @Test void expiresAtDeadlineAndEvictsLeastRecentlyUsed() {
        Clock clock = mock(Clock.class);
        Instant now = Instant.parse("2026-10-12T10:00:00Z");
        when(clock.instant()).thenReturn(now);
        ExpiringCache<String, String> cache = new ExpiringCache<>(2, clock);
        cache.put("a", "first", now.plusSeconds(60));
        cache.put("b", "second", now.plusSeconds(60));
        assertEquals("first", cache.get("a"));
        cache.put("c", "third", now.plusSeconds(60));
        assertNull(cache.get("b"));
        when(clock.instant()).thenReturn(now.plusSeconds(60));
        assertNull(cache.get("a"));
        assertNull(cache.get("c"));
    }
}

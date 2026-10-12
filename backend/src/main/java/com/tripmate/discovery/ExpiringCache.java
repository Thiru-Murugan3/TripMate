package com.tripmate.discovery;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** Small bounded LRU cache. Expired values are never returned. */
public final class ExpiringCache<K, V> {
    private final int capacity;
    private final Clock clock;
    private final Map<K, Entry<V>> entries = new LinkedHashMap<>(16, .75f, true);

    public ExpiringCache(int capacity) { this(capacity, Clock.systemUTC()); }
    ExpiringCache(int capacity, Clock clock) {
        if (capacity < 1) throw new IllegalArgumentException("Capacity must be positive");
        this.capacity = capacity;
        this.clock = clock;
    }
    public synchronized V get(K key) {
        Entry<V> entry = entries.get(key);
        if (entry == null) return null;
        if (!entry.expiresAt().isAfter(clock.instant())) {
            entries.remove(key);
            return null;
        }
        return entry.value();
    }
    public synchronized void put(K key, V value, Instant expiresAt) {
        entries.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(clock.instant()));
        if (!expiresAt.isAfter(clock.instant())) return;
        entries.put(key, new Entry<>(value, expiresAt));
        while (entries.size() > capacity) entries.remove(entries.keySet().iterator().next());
    }
    private record Entry<V>(V value, Instant expiresAt) {}
}

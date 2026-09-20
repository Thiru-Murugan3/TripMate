package com.tripmate.discovery;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

public record DiscoverySearchFilters(
        String category,
        String subcategory,
        String itemType,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        String priceStatus,
        Boolean openNow,
        Boolean familyFriendly,
        String difficulty,
        Integer minDuration,
        Integer maxDuration,
        Double minRating,
        String sort,
        int page,
        int size
) {
    public Map<String, Object> asMap() {
        Map<String, Object> filters = new LinkedHashMap<>();
        put(filters, "category", category);
        put(filters, "subcategory", subcategory);
        put(filters, "itemType", itemType);
        put(filters, "minPrice", minPrice);
        put(filters, "maxPrice", maxPrice);
        put(filters, "priceStatus", priceStatus);
        put(filters, "openNow", openNow);
        put(filters, "familyFriendly", familyFriendly);
        put(filters, "difficulty", difficulty);
        put(filters, "minDuration", minDuration);
        put(filters, "maxDuration", maxDuration);
        put(filters, "minRating", minRating);
        put(filters, "sort", sort);
        filters.put("page", page);
        filters.put("size", size);
        return Map.copyOf(filters);
    }

    private static void put(Map<String, Object> target, String key, Object value) {
        if (value != null && (!(value instanceof String text) || !text.isBlank())) target.put(key, value);
    }
}

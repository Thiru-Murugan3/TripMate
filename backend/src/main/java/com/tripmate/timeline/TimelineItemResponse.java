package com.tripmate.timeline;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Builder
public record TimelineItemResponse(
        String id,
        String sourceType,
        Long sourceId,
        TimelineItemType itemType,
        String category,
        String title,
        String subtitle,
        LocalDateTime startDatetime,
        LocalDateTime endDatetime,
        String timeFormatted,
        String endTimeFormatted,
        String location,
        String departure,
        String arrival,
        String provider,
        String bookingReference,
        String status,
        BigDecimal amount,
        String currency,
        String notes,
        String icon,
        String badgeColor,
        boolean conflict,
        String warning
) {
}

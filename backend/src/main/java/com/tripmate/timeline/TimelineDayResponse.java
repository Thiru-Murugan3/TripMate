package com.tripmate.timeline;

import lombok.Builder;

import java.time.LocalDate;
import java.util.List;

@Builder
public record TimelineDayResponse(
        int dayNumber,
        LocalDate date,
        String formattedDate,
        String title,
        String notes,
        boolean hasConflict,
        List<TimelineItemResponse> items
) {
}

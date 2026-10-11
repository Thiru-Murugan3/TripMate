package com.tripmate.timeline;

import lombok.Builder;

import java.time.LocalDate;
import java.util.List;

@Builder
public record TripTimelineResponse(
        Long tripId,
        String tripName,
        String destination,
        LocalDate startDate,
        LocalDate endDate,
        int totalEvents,
        int transportCount,
        int stayCount,
        int activityCount,
        int mealCount,
        int conflictCount,
        List<TimelineDayResponse> days
) {
}

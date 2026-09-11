package com.tripmate.itinerary;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

public record TripItineraryResponse(
        Long tripId,
        Integer totalDays,
        Integer totalActivities,
        BigDecimal totalEstimatedCost,
        List<ItineraryDayResponse> days
) {
    public static TripItineraryResponse from(Long tripId, List<ItineraryDayResponse> days) {
        int totalActivities = days.stream()
                .mapToInt(d -> d.items() != null ? d.items().size() : 0)
                .sum();

        BigDecimal totalCost = days.stream()
                .flatMap(d -> d.items() != null ? d.items().stream() : java.util.stream.Stream.empty())
                .map(ItineraryItemResponse::estimatedCost)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new TripItineraryResponse(
                tripId,
                days.size(),
                totalActivities,
                totalCost,
                days
        );
    }
}

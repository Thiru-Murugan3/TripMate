package com.tripmate.itinerary;

import java.math.BigDecimal;
import java.time.LocalTime;

public record ItineraryItemResponse(
        Long id,
        Long dayId,
        Long tripId,
        Long placeId,
        String placeName,
        String title,
        String description,
        LocalTime startTime,
        LocalTime endTime,
        String location,
        BigDecimal estimatedCost,
        Integer displayOrder
) {
    public static ItineraryItemResponse from(ItineraryItem item) {
        return new ItineraryItemResponse(
                item.getId(),
                item.getItineraryDay().getId(),
                item.getTrip().getId(),
                item.getPlace() != null ? item.getPlace().getId() : null,
                item.getPlace() != null ? item.getPlace().getName() : null,
                item.getTitle(),
                item.getDescription(),
                item.getStartTime(),
                item.getEndTime(),
                item.getLocation(),
                item.getEstimatedCost(),
                item.getDisplayOrder()
        );
    }
}

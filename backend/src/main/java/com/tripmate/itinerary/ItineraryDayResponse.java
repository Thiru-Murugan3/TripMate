package com.tripmate.itinerary;

import java.time.LocalDate;
import java.util.List;

public record ItineraryDayResponse(
        Long id,
        Long tripId,
        Integer dayNumber,
        LocalDate dayDate,
        String title,
        String notes,
        List<ItineraryItemResponse> items
) {
    public static ItineraryDayResponse from(ItineraryDay day) {
        return new ItineraryDayResponse(
                day.getId(),
                day.getTrip().getId(),
                day.getDayNumber(),
                day.getDayDate(),
                day.getTitle(),
                day.getNotes(),
                day.getItems() != null
                        ? day.getItems().stream().map(ItineraryItemResponse::from).toList()
                        : List.of()
        );
    }
}

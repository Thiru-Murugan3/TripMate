package com.tripmate.place;

import java.math.BigDecimal;

public record PlaceResponse(
        Long id,
        Long tripId,
        String name,
        PlaceCategory category,
        BigDecimal latitude,
        BigDecimal longitude,
        BigDecimal estimatedCost,
        String notes
) {
    public static PlaceResponse from(Place place) {
        return new PlaceResponse(
                place.getId(),
                place.getTrip().getId(),
                place.getName(),
                place.getCategory(),
                place.getLatitude(),
                place.getLongitude(),
                place.getEstimatedCost(),
                place.getNotes()
        );
    }
}

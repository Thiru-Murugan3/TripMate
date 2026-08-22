package com.tripmate.trip;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record TripResponse(
        Long id,
        String name,
        String destination,
        TripType tripType,
        LocalDate startDate,
        LocalDate endDate,
        Integer travelerCount,
        BigDecimal budget,
        String description,
        String coverImageUrl,
        TripStatus status,
        Long ownerId,
        String ownerName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static TripResponse from(Trip trip) {
        return new TripResponse(
                trip.getId(),
                trip.getName(),
                trip.getDestination(),
                trip.getTripType(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getTravelerCount(),
                trip.getBudget(),
                trip.getDescription(),
                trip.getCoverImageUrl(),
                trip.getStatus(),
                trip.getOwner().getId(),
                trip.getOwner().getName(),
                trip.getCreatedAt(),
                trip.getUpdatedAt()
        );
    }
}

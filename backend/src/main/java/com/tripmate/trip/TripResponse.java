package com.tripmate.trip;

import com.tripmate.member.TripRole;

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
        TripRole userRole,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static TripResponse from(Trip trip) {
        return from(trip, TripRole.OWNER);
    }

    public static TripResponse from(Trip trip, TripRole userRole) {
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
                resolveDisplayStatus(trip),
                trip.getOwner().getId(),
                trip.getOwner().getName(),
                userRole,
                trip.getCreatedAt(),
                trip.getUpdatedAt()
        );
    }

    private static TripStatus resolveDisplayStatus(Trip trip) {
        if (trip.getStatus() == TripStatus.CANCELLED) {
            return TripStatus.CANCELLED;
        }

        LocalDate today = LocalDate.now();

        if (today.isAfter(trip.getEndDate())) {
            return TripStatus.COMPLETED;
        }

        if (!today.isBefore(trip.getStartDate())) {
            return TripStatus.ONGOING;
        }

        if (trip.getStatus() == TripStatus.PLANNED
                || trip.getStatus() == TripStatus.UPCOMING
                || trip.getStatus() == TripStatus.CONFIRMED) {
            return trip.getStatus();
        }

        return TripStatus.UPCOMING;
    }
}

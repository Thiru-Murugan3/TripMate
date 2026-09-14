package com.tripmate.trip;

import com.tripmate.user.User;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TripResponseTest {

    private final User owner = User.builder()
            .id(1L)
            .name("Owner")
            .email("owner@example.com")
            .build();

    @Test
    void futureTripKeepsPlanningStatus() {
        Trip trip = trip(
                LocalDate.now().plusDays(5),
                LocalDate.now().plusDays(8),
                TripStatus.PLANNED
        );

        assertEquals(TripStatus.PLANNED, TripResponse.from(trip).status());
    }

    @Test
    void futureTripKeepsConfirmedStatus() {
        Trip trip = trip(
                LocalDate.now().plusDays(5),
                LocalDate.now().plusDays(8),
                TripStatus.CONFIRMED
        );

        assertEquals(TripStatus.CONFIRMED, TripResponse.from(trip).status());
    }

    @Test
    void tripShowsOngoingOnlyWhenCurrentDateIsInsideTripDates() {
        Trip trip = trip(
                LocalDate.now().minusDays(1),
                LocalDate.now().plusDays(1),
                TripStatus.CONFIRMED
        );

        assertEquals(TripStatus.ONGOING, TripResponse.from(trip).status());
    }

    @Test
    void tripShowsCompletedOnlyAfterEndDate() {
        Trip trip = trip(
                LocalDate.now().minusDays(5),
                LocalDate.now().minusDays(1),
                TripStatus.UPCOMING
        );

        assertEquals(TripStatus.COMPLETED, TripResponse.from(trip).status());
    }

    @Test
    void cancelledTripAlwaysStaysCancelled() {
        Trip trip = trip(
                LocalDate.now().minusDays(1),
                LocalDate.now().plusDays(1),
                TripStatus.CANCELLED
        );

        assertEquals(TripStatus.CANCELLED, TripResponse.from(trip).status());
    }

    private Trip trip(LocalDate startDate, LocalDate endDate, TripStatus status) {
        return Trip.builder()
                .id(10L)
                .owner(owner)
                .name("Test Trip")
                .destination("Chennai")
                .tripType(TripType.FAMILY)
                .startDate(startDate)
                .endDate(endDate)
                .travelerCount(2)
                .budget(new BigDecimal("10000.00"))
                .status(status)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}

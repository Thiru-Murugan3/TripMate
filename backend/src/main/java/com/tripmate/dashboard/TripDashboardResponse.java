package com.tripmate.dashboard;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.tripmate.booking.BookingStatus;
import com.tripmate.booking.BookingType;
import com.tripmate.trip.TripType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripDashboardResponse {

    private Long tripId;
    private String tripName;
    private String destination;
    private LocalDate startDate;
    private LocalDate endDate;
    private TripType tripType;
    private Integer travelerCount;

    private BigDecimal budget;
    private BigDecimal totalExpenses;
    private BigDecimal remainingBudget;
    private Double budgetUtilizationPercentage;

    private List<UpcomingActivityResponse> upcomingActivities;
    private List<DashboardBookingResponse> bookings;

    private long documentCount;
    private long memberCount;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpcomingActivityResponse {
        private String activity;
        private LocalDate date;
        @JsonFormat(pattern = "HH:mm")
        private LocalTime time;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DashboardBookingResponse {
        private BookingType bookingType;
        private String providerName;
        private BookingStatus status;
    }
}

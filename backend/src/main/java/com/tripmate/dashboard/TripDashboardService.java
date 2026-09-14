package com.tripmate.dashboard;

import com.tripmate.booking.Booking;
import com.tripmate.booking.BookingRepository;
import com.tripmate.document.DocumentRepository;
import com.tripmate.expense.Expense;
import com.tripmate.expense.ExpenseRepository;
import com.tripmate.itinerary.ItineraryDay;
import com.tripmate.itinerary.ItineraryDayRepository;
import com.tripmate.itinerary.ItineraryItem;
import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMember;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TripDashboardService {

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final ExpenseRepository expenseRepository;
    private final ItineraryDayRepository itineraryDayRepository;
    private final BookingRepository bookingRepository;
    private final DocumentRepository documentRepository;

    @Transactional(readOnly = true)
    public TripDashboardResponse getDashboard(Long tripId, Long userId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip not found"));

        verifyCanView(trip, userId);

        // Budget & Expense calculations
        BigDecimal budget = trip.getBudget() != null ? trip.getBudget() : BigDecimal.ZERO;

        List<Expense> expenses = expenseRepository.findByTripIdOrderByExpenseDateDescIdDesc(tripId);
        BigDecimal totalExpenses = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal remainingBudget = budget.subtract(totalExpenses);

        Double utilizationPercentage = 0.0;
        if (budget.compareTo(BigDecimal.ZERO) > 0) {
            utilizationPercentage = totalExpenses
                    .multiply(BigDecimal.valueOf(100))
                    .divide(budget, 2, RoundingMode.HALF_UP)
                    .doubleValue();
        }

        // Upcoming Activities: only today/future activities are shown on the dashboard.
        List<ItineraryDay> days = itineraryDayRepository.findByTripIdOrderByDayNumberAsc(tripId);
        List<TripDashboardResponse.UpcomingActivityResponse> upcomingActivities =
                buildUpcomingActivities(trip, days);

        // Bookings
        List<Booking> bookingsList = bookingRepository.findByTripIdOrderByStartDatetimeAscIdDesc(tripId);
        List<TripDashboardResponse.DashboardBookingResponse> bookings = bookingsList.stream()
                .map(b -> TripDashboardResponse.DashboardBookingResponse.builder()
                        .bookingType(b.getBookingType())
                        .providerName(b.getProviderName())
                        .status(b.getStatus())
                        .build())
                .toList();

        // Counts
        long documentCount = documentRepository.findByTripIdOrderByCreatedAtDesc(tripId).size();

        // Count active trip users once. The owner is normally stored in trip_members as OWNER.
        List<TripMember> activeMembers =
                tripMemberRepository.findByTripIdAndMemberStatus(tripId, MemberStatus.ACTIVE);
        Set<Long> activeUserIds = new HashSet<>();
        for (TripMember member : activeMembers) {
            if (member.getUser() != null && member.getUser().getId() != null) {
                activeUserIds.add(member.getUser().getId());
            }
        }
        activeUserIds.add(trip.getOwner().getId());
        long totalMemberCount = activeUserIds.size();

        return TripDashboardResponse.builder()
                .tripId(trip.getId())
                .tripName(trip.getName())
                .destination(trip.getDestination())
                .startDate(trip.getStartDate())
                .endDate(trip.getEndDate())
                .tripType(trip.getTripType())
                .travelerCount(trip.getTravelerCount())
                .budget(budget)
                .totalExpenses(totalExpenses)
                .remainingBudget(remainingBudget)
                .budgetUtilizationPercentage(utilizationPercentage)
                .upcomingActivities(upcomingActivities)
                .bookings(bookings)
                .documentCount(documentCount)
                .memberCount(totalMemberCount)
                .build();
    }

    private List<TripDashboardResponse.UpcomingActivityResponse> buildUpcomingActivities(
            Trip trip,
            List<ItineraryDay> days
    ) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        List<TripDashboardResponse.UpcomingActivityResponse> activities = new ArrayList<>();

        for (ItineraryDay day : days) {
            LocalDate activityDate = day.getDayDate();
            if (activityDate == null && trip.getStartDate() != null && day.getDayNumber() != null) {
                activityDate = trip.getStartDate().plusDays(Math.max(0, day.getDayNumber() - 1L));
            }

            if (activityDate == null || activityDate.isBefore(today) || day.getItems() == null) {
                continue;
            }

            for (ItineraryItem item : day.getItems()) {
                if (activityDate.equals(today)
                        && item.getStartTime() != null
                        && item.getStartTime().isBefore(now)) {
                    continue;
                }

                activities.add(TripDashboardResponse.UpcomingActivityResponse.builder()
                        .activity(item.getTitle())
                        .date(activityDate)
                        .time(item.getStartTime())
                        .build());
            }
        }

        activities.sort(
                Comparator.comparing(
                                TripDashboardResponse.UpcomingActivityResponse::getDate,
                                Comparator.nullsLast(Comparator.naturalOrder())
                        )
                        .thenComparing(
                                TripDashboardResponse.UpcomingActivityResponse::getTime,
                                Comparator.nullsLast(Comparator.naturalOrder())
                        )
        );

        return activities;
    }

    private void verifyCanView(Trip trip, Long userId) {
        if (trip.getOwner().getId().equals(userId)) {
            return;
        }
        boolean isMember = tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(
                trip.getId(), userId, MemberStatus.ACTIVE);
        if (!isMember) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "You do not have access to this trip dashboard");
        }
    }
}

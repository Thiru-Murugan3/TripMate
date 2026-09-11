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
import java.util.ArrayList;
import java.util.List;

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

        // Upcoming Activities
        List<ItineraryDay> days = itineraryDayRepository.findByTripIdOrderByDayNumberAsc(tripId);
        List<TripDashboardResponse.UpcomingActivityResponse> upcomingActivities = new ArrayList<>();
        for (ItineraryDay day : days) {
            if (day.getItems() != null) {
                for (ItineraryItem item : day.getItems()) {
                    upcomingActivities.add(TripDashboardResponse.UpcomingActivityResponse.builder()
                            .activity(item.getTitle())
                            .date(day.getDayDate())
                            .time(item.getStartTime())
                            .build());
                }
            }
        }

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

        // Member count includes owner + active members
        long activeMemberCount = tripMemberRepository.findByTripIdAndMemberStatus(tripId, MemberStatus.ACTIVE).size();
        long totalMemberCount = 1 + activeMemberCount; // 1 for owner

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

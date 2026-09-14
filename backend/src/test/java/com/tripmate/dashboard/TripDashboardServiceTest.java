package com.tripmate.dashboard;

import com.tripmate.booking.BookingRepository;
import com.tripmate.document.DocumentRepository;
import com.tripmate.expense.ExpenseRepository;
import com.tripmate.itinerary.ItineraryDay;
import com.tripmate.itinerary.ItineraryDayRepository;
import com.tripmate.itinerary.ItineraryItem;
import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMember;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.trip.TripType;
import com.tripmate.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripDashboardServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private ItineraryDayRepository itineraryDayRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private DocumentRepository documentRepository;

    @InjectMocks
    private TripDashboardService dashboardService;

    private User owner;
    private Trip trip;

    @BeforeEach
    void setUp() {
        owner = User.builder()
                .id(1L)
                .name("Owner User")
                .email("owner@example.com")
                .build();

        trip = Trip.builder()
                .id(10L)
                .owner(owner)
                .name("Manali Trip")
                .destination("Manali")
                .tripType(TripType.FRIENDS)
                .startDate(LocalDate.now().plusDays(2))
                .endDate(LocalDate.now().plusDays(7))
                .travelerCount(4)
                .budget(new BigDecimal("20000.00"))
                .build();
    }

    @Test
    @DisplayName("getDashboard: Aggregates budget, counts, and itinerary details for owner")
    void getDashboard_Owner_Success() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(expenseRepository.findByTripIdOrderByExpenseDateDescIdDesc(10L)).thenReturn(List.of());
        when(itineraryDayRepository.findByTripIdOrderByDayNumberAsc(10L)).thenReturn(List.of());
        when(bookingRepository.findByTripIdOrderByStartDatetimeAscIdDesc(10L)).thenReturn(List.of());
        when(documentRepository.findByTripIdOrderByCreatedAtDesc(10L)).thenReturn(List.of());
        when(tripMemberRepository.findByTripIdAndMemberStatus(10L, com.tripmate.member.MemberStatus.ACTIVE))
                .thenReturn(List.of());

        TripDashboardResponse dashboard = dashboardService.getDashboard(10L, 1L);

        assertNotNull(dashboard);
        assertEquals(10L, dashboard.getTripId());
        assertEquals("Manali Trip", dashboard.getTripName());
        assertEquals("Manali", dashboard.getDestination());
        assertEquals(new BigDecimal("20000.00"), dashboard.getBudget());
        assertEquals(1, dashboard.getMemberCount()); // 1 owner
    }

    @Test
    @DisplayName("getDashboard: Returns only future itinerary activities")
    void getDashboard_ReturnsOnlyUpcomingActivities() {
        ItineraryItem pastItem = ItineraryItem.builder()
                .title("Past activity")
                .startTime(LocalTime.of(10, 0))
                .build();
        ItineraryDay pastDay = ItineraryDay.builder()
                .dayNumber(1)
                .dayDate(LocalDate.now().minusDays(1))
                .items(List.of(pastItem))
                .build();

        ItineraryItem futureItem = ItineraryItem.builder()
                .title("Future activity")
                .startTime(LocalTime.of(9, 30))
                .build();
        ItineraryDay futureDay = ItineraryDay.builder()
                .dayNumber(2)
                .dayDate(LocalDate.now().plusDays(1))
                .items(List.of(futureItem))
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(expenseRepository.findByTripIdOrderByExpenseDateDescIdDesc(10L)).thenReturn(List.of());
        when(itineraryDayRepository.findByTripIdOrderByDayNumberAsc(10L))
                .thenReturn(List.of(pastDay, futureDay));
        when(bookingRepository.findByTripIdOrderByStartDatetimeAscIdDesc(10L)).thenReturn(List.of());
        when(documentRepository.findByTripIdOrderByCreatedAtDesc(10L)).thenReturn(List.of());
        when(tripMemberRepository.findByTripIdAndMemberStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of());

        TripDashboardResponse dashboard = dashboardService.getDashboard(10L, 1L);

        assertEquals(1, dashboard.getUpcomingActivities().size());
        assertEquals("Future activity", dashboard.getUpcomingActivities().get(0).getActivity());
    }

    @Test
    @DisplayName("getDashboard: Counts owner only once when owner exists in trip members")
    void getDashboard_CountsOwnerOnlyOnce() {
        User memberUser = User.builder()
                .id(2L)
                .name("Member User")
                .email("member@example.com")
                .build();

        TripMember ownerMember = TripMember.builder()
                .trip(trip)
                .user(owner)
                .role(TripRole.OWNER)
                .memberStatus(MemberStatus.ACTIVE)
                .build();
        TripMember editorMember = TripMember.builder()
                .trip(trip)
                .user(memberUser)
                .role(TripRole.EDITOR)
                .memberStatus(MemberStatus.ACTIVE)
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(expenseRepository.findByTripIdOrderByExpenseDateDescIdDesc(10L)).thenReturn(List.of());
        when(itineraryDayRepository.findByTripIdOrderByDayNumberAsc(10L)).thenReturn(List.of());
        when(bookingRepository.findByTripIdOrderByStartDatetimeAscIdDesc(10L)).thenReturn(List.of());
        when(documentRepository.findByTripIdOrderByCreatedAtDesc(10L)).thenReturn(List.of());
        when(tripMemberRepository.findByTripIdAndMemberStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(ownerMember, editorMember));

        TripDashboardResponse dashboard = dashboardService.getDashboard(10L, 1L);

        assertEquals(2, dashboard.getMemberCount());
    }
}

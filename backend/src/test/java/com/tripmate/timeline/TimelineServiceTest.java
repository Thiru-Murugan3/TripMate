package com.tripmate.timeline;

import com.tripmate.booking.Booking;
import com.tripmate.booking.BookingRepository;
import com.tripmate.booking.BookingStatus;
import com.tripmate.booking.BookingType;
import com.tripmate.booking.TransportType;
import com.tripmate.itinerary.ItineraryDay;
import com.tripmate.itinerary.ItineraryDayRepository;
import com.tripmate.itinerary.ItineraryItem;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TimelineServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private ItineraryDayRepository itineraryDayRepository;

    @InjectMocks
    private TimelineService timelineService;

    private User owner;
    private Trip trip;

    @BeforeEach
    void setUp() {
        owner = User.builder().id(1L).email("owner@example.com").name("Owner").build();
        trip = Trip.builder()
                .id(100L)
                .name("Madurai Adventure")
                .destination("Madurai")
                .owner(owner)
                .startDate(LocalDate.of(2026, 10, 15))
                .endDate(LocalDate.of(2026, 10, 16))
                .build();
    }

    @Test
    void mergesBookingsAndItineraryChronologicallyWithConflictDetection() {
        when(tripRepository.findById(100L)).thenReturn(Optional.of(trip));

        // Booking 1: Flight Departure at 06:30, Arrival at 09:45
        Booking flight = Booking.builder()
                .id(10L)
                .trip(trip)
                .bookingType(BookingType.TRANSPORT)
                .transportType(TransportType.FLIGHT)
                .providerName("IndiGo 6E-IND991")
                .bookingReference("6E-IND991")
                .departure("Chennai")
                .arrival("Madurai Airport")
                .startDatetime(LocalDateTime.of(2026, 10, 15, 6, 30))
                .endDatetime(LocalDateTime.of(2026, 10, 15, 9, 45))
                .status(BookingStatus.CONFIRMED)
                .amount(new BigDecimal("4250.00"))
                .build();

        // Booking 2: Hotel Check-in at 11:30
        Booking hotel = Booking.builder()
                .id(20L)
                .trip(trip)
                .bookingType(BookingType.HOTEL)
                .providerName("Heritage Madurai")
                .bookingReference("HOTEL-99")
                .startDatetime(LocalDateTime.of(2026, 10, 15, 11, 30))
                .endDatetime(LocalDateTime.of(2026, 10, 16, 11, 0))
                .status(BookingStatus.CONFIRMED)
                .amount(new BigDecimal("7500.00"))
                .build();

        when(bookingRepository.findByTripIdOrderByStartDatetimeAscIdDesc(100L))
                .thenReturn(List.of(flight, hotel));

        // Itinerary Day 1: Lunch at 01:00 PM, Temple at 03:30 PM
        ItineraryDay day1 = ItineraryDay.builder()
                .id(1L)
                .trip(trip)
                .dayNumber(1)
                .dayDate(LocalDate.of(2026, 10, 15))
                .title("Temple City Exploration")
                .build();

        ItineraryItem lunch = ItineraryItem.builder()
                .id(101L)
                .itineraryDay(day1)
                .trip(trip)
                .title("Authentic Chettinad Lunch")
                .startTime(LocalTime.of(13, 0))
                .endTime(LocalTime.of(14, 0))
                .location("Kumar Mess, Madurai")
                .build();

        ItineraryItem temple = ItineraryItem.builder()
                .id(102L)
                .itineraryDay(day1)
                .trip(trip)
                .title("Meenakshi Amman Temple Visit")
                .startTime(LocalTime.of(15, 30))
                .endTime(LocalTime.of(18, 0))
                .location("Madurai Meenakshi Temple")
                .build();

        day1.setItems(List.of(lunch, temple));

        when(itineraryDayRepository.findByTripIdOrderByDayNumberAsc(100L))
                .thenReturn(List.of(day1));

        TripTimelineResponse response = timelineService.getTripTimeline(100L, 1L);

        assertNotNull(response);
        assertEquals(100L, response.tripId());
        assertEquals("Madurai Adventure", response.tripName());
        assertEquals(2, response.days().size());

        // Verify Day 1
        TimelineDayResponse d1 = response.days().get(0);
        assertEquals(LocalDate.of(2026, 10, 15), d1.date());
        assertEquals(1, d1.dayNumber());
        assertEquals("Temple City Exploration", d1.title());

        // Should have Flight Departure (06:30), Flight Arrival (09:45), Hotel Check-in (11:30), Lunch (13:00), Temple (15:30)
        assertEquals(5, d1.items().size());

        assertEquals(TimelineItemType.TRANSPORT_DEPARTURE, d1.items().get(0).itemType());
        assertEquals("06:30 AM", d1.items().get(0).timeFormatted());

        assertEquals(TimelineItemType.TRANSPORT_ARRIVAL, d1.items().get(1).itemType());
        assertEquals("09:45 AM", d1.items().get(1).timeFormatted());

        assertEquals(TimelineItemType.HOTEL_CHECKIN, d1.items().get(2).itemType());
        assertEquals("11:30 AM", d1.items().get(2).timeFormatted());

        assertEquals(TimelineItemType.MEAL, d1.items().get(3).itemType());
        assertEquals("01:00 PM", d1.items().get(3).timeFormatted());

        assertEquals(TimelineItemType.ACTIVITY, d1.items().get(4).itemType());
        assertEquals("03:30 PM", d1.items().get(4).timeFormatted());

        assertEquals(0, response.conflictCount(), "Hotel stay must not block sightseeing");

        // Verify Day 2 has Hotel Check-out (11:00)
        TimelineDayResponse d2 = response.days().get(1);
        assertEquals(LocalDate.of(2026, 10, 16), d2.date());
        assertEquals(1, d2.items().size());
        assertEquals(TimelineItemType.HOTEL_CHECKOUT, d2.items().get(0).itemType());
        assertEquals("11:00 AM", d2.items().get(0).timeFormatted());
    }

    @Test
    void detectsScheduleConflictWhenEventsOverlap() {
        when(tripRepository.findById(100L)).thenReturn(Optional.of(trip));

        ItineraryDay day1 = ItineraryDay.builder()
                .id(1L)
                .trip(trip)
                .dayNumber(1)
                .dayDate(LocalDate.of(2026, 10, 15))
                .build();

        ItineraryItem item1 = ItineraryItem.builder()
                .id(101L)
                .itineraryDay(day1)
                .trip(trip)
                .title("Palace Tour")
                .startTime(LocalTime.of(14, 0))
                .endTime(LocalTime.of(16, 0))
                .location("Thirumalai Nayakkar Palace")
                .build();

        // Conflict: starts at 15:00 while Palace tour ends at 16:00
        ItineraryItem item2 = ItineraryItem.builder()
                .id(102L)
                .itineraryDay(day1)
                .trip(trip)
                .title("Audio Guided Museum Tour")
                .startTime(LocalTime.of(15, 0))
                .endTime(LocalTime.of(17, 0))
                .location("Gandhi Memorial Museum")
                .build();

        day1.setItems(List.of(item1, item2));

        when(bookingRepository.findByTripIdOrderByStartDatetimeAscIdDesc(100L))
                .thenReturn(List.of());
        when(itineraryDayRepository.findByTripIdOrderByDayNumberAsc(100L))
                .thenReturn(List.of(day1));

        TripTimelineResponse response = timelineService.getTripTimeline(100L, 1L);

        assertTrue(response.days().get(0).hasConflict());
        assertTrue(response.days().get(0).items().get(1).conflict());
        assertNotNull(response.days().get(0).items().get(1).warning());
        assertTrue(response.days().get(0).items().get(1).warning().contains("Schedule conflict"));
    }

    @Test
    void detectsOvernightAndNonAdjacentConflictsWithoutSchedulingFlexibleItems() {
        when(tripRepository.findById(100L)).thenReturn(Optional.of(trip));
        Booking train = Booking.builder().id(50L).bookingType(BookingType.TRANSPORT)
                .transportType(TransportType.TRAIN).status(BookingStatus.CONFIRMED)
                .startDatetime(LocalDateTime.of(2026, 10, 15, 22, 0))
                .endDatetime(LocalDateTime.of(2026, 10, 16, 8, 0)).build();
        Booking cancelled = Booking.builder().id(51L).bookingType(BookingType.ACTIVITY)
                .status(BookingStatus.CANCELLED)
                .startDatetime(LocalDateTime.of(2026, 10, 16, 9, 0)).build();
        when(bookingRepository.findByTripIdOrderByStartDatetimeAscIdDesc(100L))
                .thenReturn(List.of(train, cancelled));
        ItineraryDay day = ItineraryDay.builder().dayNumber(2)
                .dayDate(LocalDate.of(2026, 10, 16)).build();
        day.setItems(List.of(
                ItineraryItem.builder().id(1L).title("Early visit")
                        .startTime(LocalTime.of(6, 0)).endTime(LocalTime.of(6, 30)).build(),
                ItineraryItem.builder().id(2L).title("Second visit")
                        .startTime(LocalTime.of(7, 0)).endTime(LocalTime.of(7, 30)).build(),
                ItineraryItem.builder().id(3L).title("Flexible museum").displayOrder(100).build()));
        when(itineraryDayRepository.findByTripIdOrderByDayNumberAsc(100L)).thenReturn(List.of(day));
        var response = timelineService.getTripTimeline(100L, 1L);
        assertEquals(5, response.totalEvents()); // departure + arrival + three activities
        assertEquals(3, response.conflictCount()); // train and both activities
        var flexible = response.days().get(1).items().getLast();
        assertTrue(flexible.flexible());
        assertEquals("Flexible", flexible.timeFormatted());
        assertNull(flexible.endDatetime());
        assertFalse(flexible.conflict());
        assertEquals(LocalDate.of(2026, 10, 16), flexible.startDatetime().toLocalDate());
    }

    @Test
    void overnightActivityEndsNextDayAndAdjacentEventsDoNotOverlap() {
        when(tripRepository.findById(100L)).thenReturn(Optional.of(trip));
        when(bookingRepository.findByTripIdOrderByStartDatetimeAscIdDesc(100L)).thenReturn(List.of());
        ItineraryDay day = ItineraryDay.builder().dayNumber(1).dayDate(trip.getStartDate()).build();
        day.setItems(List.of(
                ItineraryItem.builder().id(1L).title("Evening visit")
                        .startTime(LocalTime.of(21, 0)).endTime(LocalTime.of(23, 0)).build(),
                ItineraryItem.builder().id(2L).title("Night walk")
                        .startTime(LocalTime.of(23, 0)).endTime(LocalTime.of(1, 0)).build()));
        when(itineraryDayRepository.findByTripIdOrderByDayNumberAsc(100L)).thenReturn(List.of(day));
        var response = timelineService.getTripTimeline(100L, 1L);
        assertEquals(0, response.conflictCount());
        assertEquals(LocalDateTime.of(2026, 10, 16, 1, 0),
                response.days().getFirst().items().getLast().endDatetime());
    }
}

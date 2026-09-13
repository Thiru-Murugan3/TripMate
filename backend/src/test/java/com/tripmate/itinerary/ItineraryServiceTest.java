package com.tripmate.itinerary;

import com.tripmate.member.TripMemberRepository;
import com.tripmate.place.PlaceRepository;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ItineraryServiceTest {

    @Mock
    private ItineraryDayRepository itineraryDayRepository;

    @Mock
    private ItineraryItemRepository itineraryItemRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private PlaceRepository placeRepository;

    @InjectMocks
    private ItineraryService itineraryService;

    private User owner;
    private Trip trip;
    private ItineraryDay day1;

    @BeforeEach
    void setUp() {
        owner = User.builder()
                .id(1L)
                .name("Owner")
                .email("owner@example.com")
                .build();

        trip = Trip.builder()
                .id(10L)
                .owner(owner)
                .name("Ooty Trip")
                .destination("Ooty")
                .build();

        day1 = ItineraryDay.builder()
                .id(100L)
                .trip(trip)
                .dayNumber(1)
                .dayDate(LocalDate.now())
                .title("Day 1 - Arrival")
                .build();
    }

    @Test
    @DisplayName("createDay: Owner creates itinerary day successfully")
    void createDay_Success() {
        CreateItineraryDayRequest request = new CreateItineraryDayRequest(1, LocalDate.now(), "Day 1 - Arrival", "Welcome");

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(itineraryDayRepository.existsByTripIdAndDayNumber(10L, 1)).thenReturn(false);
        when(itineraryDayRepository.save(any(ItineraryDay.class))).thenAnswer(invocation -> {
            ItineraryDay d = invocation.getArgument(0);
            d.setId(100L);
            return d;
        });

        ItineraryDayResponse response = itineraryService.createDay(10L, 1L, request);

        assertNotNull(response);
        assertEquals(100L, response.id());
        assertEquals(1, response.dayNumber());
        assertEquals("Day 1 - Arrival", response.title());
    }

    @Test
    @DisplayName("createDay: Duplicate day number throws 409 CONFLICT")
    void createDay_DuplicateDayNumber_ThrowsConflict() {
        CreateItineraryDayRequest request = new CreateItineraryDayRequest(1, LocalDate.now(), "Day 1 - Arrival", null);

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(itineraryDayRepository.existsByTripIdAndDayNumber(10L, 1)).thenReturn(true);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> itineraryService.createDay(10L, 1L, request));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().contains("already exists for this trip"));
    }

    @Test
    @DisplayName("createItem: Creates itinerary item on Day 1 successfully")
    void createItem_Success() {
        CreateItineraryItemRequest request = new CreateItineraryItemRequest(
                null,
                "Visit Botanical Garden",
                "Explore flowers",
                LocalTime.of(10, 0),
                LocalTime.of(12, 0),
                "Ooty Center",
                new BigDecimal("50.00"),
                1
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(itineraryDayRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.of(day1));
        when(itineraryItemRepository.save(any(ItineraryItem.class))).thenAnswer(invocation -> {
            ItineraryItem item = invocation.getArgument(0);
            item.setId(500L);
            return item;
        });

        ItineraryItemResponse response = itineraryService.createItem(10L, 100L, 1L, request);

        assertNotNull(response);
        assertEquals(500L, response.id());
        assertEquals("Visit Botanical Garden", response.title());
        assertEquals(new BigDecimal("50.00"), response.estimatedCost());
    }

    @Test
    @DisplayName("createItem: End time before start time throws 400 BAD REQUEST")
    void createItem_EndTimeBeforeStartTime_ThrowsBadRequest() {
        CreateItineraryItemRequest request = new CreateItineraryItemRequest(
                null,
                "Invalid Timing",
                null,
                LocalTime.of(14, 0),
                LocalTime.of(10, 0),
                null,
                null,
                1
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(itineraryDayRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.of(day1));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> itineraryService.createItem(10L, 100L, 1L, request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("End time cannot be before start time"));
    }
}

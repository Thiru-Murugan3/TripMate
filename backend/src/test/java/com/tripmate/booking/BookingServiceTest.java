package com.tripmate.booking;

import com.tripmate.member.TripMemberRepository;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @InjectMocks
    private BookingService bookingService;

    private User owner;
    private Trip trip;

    @BeforeEach
    void setUp() {
        owner = User.builder()
                .id(1L)
                .email("owner@example.com")
                .build();

        trip = Trip.builder()
                .id(10L)
                .owner(owner)
                .name("Kodaikanal Trip")
                .destination("Kodaikanal")
                .build();
    }

    @Test
    @DisplayName("createBooking: Valid TRANSPORT booking with TRAIN succeeds")
    void createBooking_ValidTransport_Success() {
        CreateBookingRequest request = new CreateBookingRequest(
                BookingType.TRANSPORT,
                TransportType.TRAIN,
                "Indian Railways",
                "PNR123456",
                null,
                null,
                new BigDecimal("850.00"),
                BookingStatus.CONFIRMED,
                "Chennai to Kodaikanal"
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> {
            Booking b = invocation.getArgument(0);
            b.setId(100L);
            return b;
        });

        BookingResponse response = bookingService.createBooking(10L, 1L, request);

        assertNotNull(response);
        assertEquals(100L, response.id());
        assertEquals(10L, response.tripId());
        assertEquals(BookingType.TRANSPORT, response.bookingType());
        assertEquals(TransportType.TRAIN, response.transportType());
        assertEquals("Indian Railways", response.providerName());
        assertEquals(new BigDecimal("850.00"), response.amount());
    }

    @Test
    @DisplayName("createBooking: TRANSPORT booking missing transportType throws 400 BAD REQUEST")
    void createBooking_TransportTypeMissing_ThrowsBadRequest() {
        CreateBookingRequest request = new CreateBookingRequest(
                BookingType.TRANSPORT,
                null,
                "Indian Railways",
                null,
                null,
                null,
                new BigDecimal("850.00"),
                BookingStatus.CONFIRMED,
                null
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(10L, 1L, request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Transport type is required for TRANSPORT bookings"));
        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("createBooking: HOTEL booking with transportType throws 400 BAD REQUEST")
    void createBooking_HotelWithTransportType_ThrowsBadRequest() {
        CreateBookingRequest request = new CreateBookingRequest(
                BookingType.HOTEL,
                TransportType.CAR,
                "Kodai Resort",
                null,
                null,
                null,
                new BigDecimal("3000.00"),
                BookingStatus.CONFIRMED,
                null
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(10L, 1L, request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Transport type must be null for HOTEL bookings"));
        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("createBooking: ACTIVITY booking with transportType throws 400 BAD REQUEST")
    void createBooking_ActivityWithTransportType_ThrowsBadRequest() {
        CreateBookingRequest request = new CreateBookingRequest(
                BookingType.ACTIVITY,
                TransportType.BUS,
                "Adventure Zone",
                null,
                null,
                null,
                new BigDecimal("500.00"),
                BookingStatus.CONFIRMED,
                null
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(10L, 1L, request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Transport type must be null for ACTIVITY bookings"));
        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateBooking: Updates TRANSPORT booking from BUS to TRAIN")
    void updateBooking_TransportTypeUpdated_Success() {
        Booking existingBooking = Booking.builder()
                .id(100L)
                .trip(trip)
                .bookingType(BookingType.TRANSPORT)
                .transportType(TransportType.BUS)
                .providerName("KPN Travels")
                .amount(new BigDecimal("600.00"))
                .status(BookingStatus.CONFIRMED)
                .build();

        UpdateBookingRequest request = new UpdateBookingRequest(
                BookingType.TRANSPORT,
                TransportType.TRAIN,
                "Indian Railways",
                "PNR987654",
                null,
                null,
                new BigDecimal("850.00"),
                BookingStatus.CONFIRMED,
                "Updated to Train"
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(bookingRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.of(existingBooking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        BookingResponse response = bookingService.updateBooking(10L, 100L, 1L, request);

        assertNotNull(response);
        assertEquals(BookingType.TRANSPORT, response.bookingType());
        assertEquals(TransportType.TRAIN, response.transportType());
        assertEquals("Indian Railways", response.providerName());
    }
}

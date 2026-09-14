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
    @DisplayName("createBooking: Valid TRANSPORT booking with TRAIN, departure, and arrival succeeds")
    void createBooking_ValidTransport_Success() {
        CreateBookingRequest request = new CreateBookingRequest(
                BookingType.TRANSPORT,
                TransportType.TRAIN,
                "Indian Railways",
                "PNR123456",
                "Chennai",
                "Kodaikanal",
                null,
                null,
                new BigDecimal("850.00"),
                BookingStatus.CONFIRMED,
                "Night train"
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
        assertEquals("Chennai", response.departure());
        assertEquals("Kodaikanal", response.arrival());
        assertEquals(new BigDecimal("850.00"), response.amount());
    }

    @Test
    @DisplayName("createBooking: TRANSPORT booking missing departure throws 400 BAD REQUEST")
    void createBooking_TransportDepartureMissing_ThrowsBadRequest() {
        CreateBookingRequest request = new CreateBookingRequest(
                BookingType.TRANSPORT,
                TransportType.TRAIN,
                "Indian Railways",
                "PNR123456",
                null,
                "Kodaikanal",
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
        assertTrue(ex.getReason().contains("Departure location is required for TRANSPORT bookings"));
        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("createBooking: TRANSPORT booking missing arrival throws 400 BAD REQUEST")
    void createBooking_TransportArrivalMissing_ThrowsBadRequest() {
        CreateBookingRequest request = new CreateBookingRequest(
                BookingType.TRANSPORT,
                TransportType.TRAIN,
                "Indian Railways",
                "PNR123456",
                "Chennai",
                "",
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
        assertTrue(ex.getReason().contains("Arrival location is required for TRANSPORT bookings"));
        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("createBooking: HOTEL booking with departure/arrival locations throws 400 BAD REQUEST")
    void createBooking_HotelWithDepartureArrival_ThrowsBadRequest() {
        CreateBookingRequest request = new CreateBookingRequest(
                BookingType.HOTEL,
                null,
                "Kodai Resort",
                null,
                "Chennai",
                "Kodaikanal",
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
        assertTrue(ex.getReason().contains("Departure and arrival locations must be null for HOTEL bookings"));
        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateBooking: Updates TRANSPORT booking departure and arrival locations")
    void updateBooking_DepartureArrivalUpdated_Success() {
        Booking existingBooking = Booking.builder()
                .id(100L)
                .trip(trip)
                .bookingType(BookingType.TRANSPORT)
                .transportType(TransportType.BUS)
                .providerName("KPN Travels")
                .departure("Madurai")
                .arrival("Kodaikanal")
                .amount(new BigDecimal("600.00"))
                .status(BookingStatus.CONFIRMED)
                .build();

        UpdateBookingRequest request = new UpdateBookingRequest(
                BookingType.TRANSPORT,
                TransportType.TRAIN,
                "Indian Railways",
                "PNR987654",
                "Chennai",
                "Kodaikanal",
                null,
                null,
                new BigDecimal("850.00"),
                BookingStatus.CONFIRMED,
                "Updated route"
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(bookingRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.of(existingBooking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        BookingResponse response = bookingService.updateBooking(10L, 100L, 1L, request);

        assertNotNull(response);
        assertEquals(BookingType.TRANSPORT, response.bookingType());
        assertEquals(TransportType.TRAIN, response.transportType());
        assertEquals("Chennai", response.departure());
        assertEquals("Kodaikanal", response.arrival());
    }
    @Test
    @DisplayName("cancelBooking: Refundable sandbox booking is cancelled and refunded")
    void cancelBooking_RefundableSandbox_RefundsPayment() {
        Booking booking = Booking.builder()
                .id(100L)
                .trip(trip)
                .bookingType(BookingType.TRANSPORT)
                .transportType(TransportType.FLIGHT)
                .providerName("TripMate Air Sandbox")
                .departure("Chennai")
                .arrival("Goa")
                .startDatetime(java.time.LocalDateTime.now().plusDays(3))
                .amount(new BigDecimal("5000.00"))
                .status(BookingStatus.CONFIRMED)
                .bookingSource(BookingSource.TRIPMATE_SANDBOX)
                .paymentStatus(PaymentStatus.PAID)
                .currency("INR")
                .refundable(true)
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(bookingRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CancelBookingResponse response = bookingService.cancelBooking(
                10L,
                100L,
                1L,
                new CancelBookingRequest("Plans changed")
        );

        assertEquals(BookingStatus.CANCELLED, response.booking().status());
        assertEquals(PaymentStatus.REFUNDED, response.booking().paymentStatus());
        assertEquals("Plans changed", response.booking().cancellationReason());
        assertNotNull(response.booking().cancelledAt());
    }

    @Test
    @DisplayName("cancelBooking: Completed booking cannot be cancelled")
    void cancelBooking_Completed_ThrowsBadRequest() {
        Booking booking = Booking.builder()
                .id(100L)
                .trip(trip)
                .bookingType(BookingType.HOTEL)
                .providerName("Test Hotel")
                .status(BookingStatus.COMPLETED)
                .bookingSource(BookingSource.EXTERNAL_MANUAL)
                .paymentStatus(PaymentStatus.NOT_REQUIRED)
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(bookingRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.of(booking));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> bookingService.cancelBooking(
                        10L,
                        100L,
                        1L,
                        new CancelBookingRequest("Too late")
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Completed bookings cannot be cancelled"));
        verify(bookingRepository, never()).save(any());
    }

}

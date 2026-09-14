package com.tripmate.booking;

import com.tripmate.member.TripMemberRepository;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.trip.TripType;
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
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingMarketplaceServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private BookingProvider bookingProvider;

    @InjectMocks
    private BookingMarketplaceService bookingMarketplaceService;

    private Trip trip;

    @BeforeEach
    void setUp() {
        User owner = User.builder()
                .id(1L)
                .name("Owner")
                .email("owner@example.com")
                .build();

        trip = Trip.builder()
                .id(10L)
                .owner(owner)
                .name("Goa Trip")
                .destination("Goa")
                .tripType(TripType.FRIENDS)
                .startDate(LocalDate.now().plusDays(10))
                .endDate(LocalDate.now().plusDays(15))
                .build();
    }

    @Test
    void searchUsesProviderForTripOwner() {
        SearchBookingRequest request = new SearchBookingRequest(
                BookingType.TRANSPORT,
                TransportType.FLIGHT,
                "Chennai",
                "Goa",
                LocalDate.now().plusDays(10),
                null,
                2
        );

        BookingSearchResponse providerResponse = new BookingSearchResponse(
                "SANDBOX",
                false,
                "sandbox",
                List.of()
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(bookingProvider.search(request)).thenReturn(providerResponse);

        BookingSearchResponse response = bookingMarketplaceService.search(10L, 1L, request);

        assertEquals("SANDBOX", response.providerMode());
        assertFalse(response.liveBookingEnabled());
    }

    @Test
    void bookNowCreatesTripMateBooking() {
        BookingOfferResponse offer = new BookingOfferResponse(
                "offer-1",
                BookingType.TRANSPORT,
                TransportType.FLIGHT,
                "TripMate Air Sandbox",
                "Economy",
                "Chennai",
                "Goa",
                LocalDateTime.now().plusDays(10),
                LocalDateTime.now().plusDays(10).plusHours(2),
                new BigDecimal("9500.00"),
                "INR",
                true
        );

        BookNowRequest request = new BookNowRequest(
                "offer-1",
                "Test Traveler",
                "traveler@example.com",
                "9999999999",
                "UPI"
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(bookingProvider.book(request)).thenReturn(
                new ProviderBookingResult(
                        offer,
                        "TM-SBX-123",
                        PaymentStatus.PAID,
                        "Sandbox booking confirmed"
                )
        );
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> {
            Booking booking = invocation.getArgument(0);
            booking.setId(100L);
            return booking;
        });

        BookNowResponse response = bookingMarketplaceService.bookNow(10L, 1L, request);

        assertNotNull(response.booking());
        assertEquals(100L, response.booking().id());
        assertEquals(BookingSource.TRIPMATE_SANDBOX, response.booking().bookingSource());
        assertEquals(PaymentStatus.PAID, response.paymentStatus());
        assertFalse(response.liveBookingEnabled());
    }
}

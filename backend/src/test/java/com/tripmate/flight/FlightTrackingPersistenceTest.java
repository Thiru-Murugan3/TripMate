package com.tripmate.flight;

import com.tripmate.booking.*;
import com.tripmate.trip.*;
import com.tripmate.user.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.*;
import org.springframework.data.domain.PageRequest;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class FlightTrackingPersistenceTest {
    @Autowired TestEntityManager em;
    @Autowired FlightTrackingRepository tracking;
    @Autowired FlightSubscriptionRepository subscriptions;
    @Test void persistsDerivedBookingIdAndFindsDueFlightsAndPreferences() {
        var user = em.persistAndFlush(User.builder().name("Traveller").email("flight@test.example").passwordHash("test").build());
        var trip = em.persistAndFlush(Trip.builder().owner(user).name("Travel").destination("Mumbai").tripType(TripType.SOLO)
                .startDate(LocalDate.now()).endDate(LocalDate.now()).build());
        var booking = em.persistAndFlush(Booking.builder().trip(trip).bookingType(BookingType.TRANSPORT)
                .transportType(TransportType.FLIGHT).providerName("Airline").build());
        var flight = new FlightTracking(); flight.setBooking(booking); flight.setIdent("AI101");
        flight.setAirlineCode("AI"); flight.setFlightNumber("101"); flight.setDepartureDate(LocalDate.now());
        flight.setOrigin("DEL"); flight.setDestination("BOM"); flight.setDepartureZone("Asia/Kolkata");
        flight.setEnabled(true); flight.setWindowStart(Instant.EPOCH); flight.setWindowEnd(Instant.now().plusSeconds(3600));
        flight.setNextPoll(Instant.EPOCH); flight.setBookingFingerprint(FlightTrackingService.fingerprint(booking));
        tracking.saveAndFlush(flight);
        assertEquals(booking.getId(),flight.getId());
        var sub = new FlightSubscription(); sub.setTracking(flight); sub.setUser(user); subscriptions.saveAndFlush(sub);
        em.clear();
        assertEquals(1,tracking.due(Instant.now(),PageRequest.of(0,5)).size());
        assertTrue(tracking.lockById(booking.getId()).isPresent());
        assertTrue(subscriptions.existsByTrackingIdAndUserId(booking.getId(),user.getId()));
        assertEquals(1,tracking.findByBookingTripId(trip.getId()).size());
    }
}

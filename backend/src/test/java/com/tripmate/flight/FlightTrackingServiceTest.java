package com.tripmate.flight;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tripmate.booking.*;
import com.tripmate.member.*;
import com.tripmate.trip.*;
import com.tripmate.user.*;
import com.tripmate.notification.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FlightTrackingServiceTest {
    @Mock FlightTrackingRepository tracking;
    @Mock FlightSubscriptionRepository subscriptions;
    @Mock BookingRepository bookings;
    @Mock TripMemberRepository members;
    @Mock UserRepository users;
    @Mock TripService trips;
    @Mock FlightProvider provider;
    @Mock FlightApiBudget budget;
    @Mock NotificationService notifications;
    FlightTrackingService service;
    FlightTracking flight;
    ObjectMapper json = new ObjectMapper().registerModule(new JavaTimeModule());

    @BeforeEach void init() {
        service = new FlightTrackingService(tracking,subscriptions,bookings,members,users,trips,provider,budget,json,notifications);
        var owner = User.builder().id(1L).build();
        var trip = Trip.builder().id(10L).owner(owner).build();
        var booking = Booking.builder().id(20L).trip(trip).transportType(TransportType.FLIGHT).build();
        flight = new FlightTracking(); flight.setId(20L); flight.setBooking(booking); flight.setIdent("AI101");
        flight.setOrigin("DEL"); flight.setDestination("BOM"); flight.setDepartureZone("Asia/Kolkata");
        flight.setEnabled(true); flight.setWindowStart(Instant.now().minusSeconds(60)); flight.setWindowEnd(Instant.now().plusSeconds(3600));
        flight.setNextPoll(Instant.EPOCH); flight.setBookingFingerprint(FlightTrackingService.fingerprint(booking));
    }
    FlightSnapshot status(String gate) { return new FlightSnapshot("SCHEDULED",null,null,null,null,null,null,gate,null,null,null); }
    void due() {
        when(provider.available()).thenReturn(true); when(tracking.lockById(20L)).thenReturn(Optional.of(flight));
    }
    @Test void unchangedSnapshotsDoNotNotifyAndDuplicatePollsDoNotFetch() throws Exception {
        due(); when(budget.reserve()).thenReturn(true);
        flight.setSnapshot(json.writeValueAsString(status("1")));
        when(provider.lookup(flight)).thenReturn(new FlightProvider.Result("provider-id",status("1")));
        service.poll(20L); service.poll(20L);
        verify(provider,times(1)).lookup(flight); verifyNoInteractions(notifications);
        assertNotNull(flight.getLastChecked());
    }
    @Test void changedGateNotifiesOnlySubscribedActiveMembers() throws Exception {
        due(); when(budget.reserve()).thenReturn(true); flight.setSnapshot(json.writeValueAsString(status("1")));
        when(provider.lookup(flight)).thenReturn(new FlightProvider.Result("provider-id",status("2")));
        var ownerSub = new FlightSubscription(); ownerSub.setUser(flight.getBooking().getTrip().getOwner());
        var removedSub = new FlightSubscription(); removedSub.setUser(User.builder().id(2L).build());
        when(subscriptions.findByTrackingId(20L)).thenReturn(List.of(ownerSub,removedSub));
        service.poll(20L);
        verify(notifications,times(1)).createAndSendNotification(eq(ownerSub.getUser()),any(),anyString(),contains("Gate: 2"),eq(NotificationType.FLIGHT_UPDATED));
        verifyNoMoreInteractions(notifications);
    }
    @Test void failureKeepsSavedStatusAndBacksOff() throws Exception {
        due(); when(budget.reserve()).thenReturn(true); String saved = json.writeValueAsString(status("1")); flight.setSnapshot(saved);
        when(provider.lookup(flight)).thenThrow(new IllegalStateException("secret provider detail"));
        service.poll(20L);
        assertEquals(saved,flight.getSnapshot()); assertNull(flight.getLastChecked());
        assertFalse(flight.getMessage().contains("secret")); assertTrue(flight.getNextPoll().isAfter(Instant.now().plusSeconds(1700)));
        verifyNoInteractions(notifications);
    }
    @Test void noCallsForCancelledBookingsOrExhaustedBudget() {
        due(); flight.getBooking().setStatus(BookingStatus.CANCELLED); service.poll(20L);
        assertFalse(flight.isEnabled()); verify(provider,never()).lookup(any());
        flight.getBooking().setStatus(BookingStatus.CONFIRMED); flight.setEnabled(true);
        when(budget.reserve()).thenReturn(false); service.poll(20L); verify(provider,never()).lookup(any());
        assertTrue(flight.getMessage().contains("allowance"));
    }
    @Test void plannerCannotConfigureAndCrossTripSubscriptionIsRejected() {
        when(bookings.lockForFlightTracking(20L,10L)).thenReturn(Optional.of(flight.getBooking()));
        when(members.findByTripIdAndUserIdAndMemberStatus(10L,2L,MemberStatus.ACTIVE))
                .thenReturn(Optional.of(TripMember.builder().role(TripRole.PLANNER).build()));
        assertEquals(403,assertThrows(ResponseStatusException.class,() -> service.configure(10L,20L,2L,null)).getStatusCode().value());
        when(tracking.lockById(20L)).thenReturn(Optional.of(flight));
        assertEquals(404,assertThrows(ResponseStatusException.class,() -> service.subscribe(99L,20L,1L,true)).getStatusCode().value());
        verifyNoInteractions(subscriptions);
    }

    @Test void bookingEditsRequireReconfirmationBeforeAnotherPaidCall() {
        due(); flight.getBooking().setDeparture("MAA"); service.poll(20L);
        assertFalse(flight.isEnabled()); assertTrue(flight.getMessage().contains("Booking details changed"));
        verify(provider,never()).lookup(any()); verifyNoInteractions(budget);
    }

    @Test void ownerCanConfigureVerifiedIdentityWithoutFetchingProvider() {
        when(provider.available()).thenReturn(true);
        when(bookings.lockForFlightTracking(20L,10L)).thenReturn(Optional.of(flight.getBooking()));
        when(tracking.lockById(20L)).thenReturn(Optional.of(flight));
        when(tracking.saveAndFlush(flight)).thenReturn(flight);
        var response = service.configure(10L,20L,1L,new FlightSetupRequest("6E","123",LocalDate.now(),"DEL","BOM","Asia/Kolkata",true));
        assertEquals("6E123",response.ident()); assertEquals("6E",response.airlineCode());
        assertFalse(response.subscribed()); assertTrue(response.enabled());
        verify(provider,never()).lookup(any());
    }
}

package com.tripmate.flight;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripmate.booking.*;
import com.tripmate.member.*;
import com.tripmate.trip.TripService;
import com.tripmate.user.UserRepository;
import com.tripmate.notification.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;

@Service @RequiredArgsConstructor
public class FlightTrackingService {
    private final FlightTrackingRepository tracking;
    private final FlightSubscriptionRepository subscriptions;
    private final BookingRepository bookings;
    private final TripMemberRepository members;
    private final UserRepository users;
    private final TripService trips;
    private final FlightProvider provider;
    private final FlightApiBudget budget;
    private final ObjectMapper json;
    private final NotificationService notifications;

    public boolean available() { return provider.available(); }

    @Transactional(readOnly=true)
    public List<FlightTrackingResponse> list(Long tripId, Long userId) {
        trips.getTripById(tripId,userId);
        return tracking.findByBookingTripId(tripId).stream().map(f -> response(f,userId)).toList();
    }

    @Transactional
    public FlightTrackingResponse configure(Long tripId, Long bookingId, Long userId, FlightSetupRequest request) {
        Booking booking = bookings.lockForFlightTracking(bookingId,tripId).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"Booking not found"));
        if (!booking.getTrip().getOwner().getId().equals(userId)
                && !members.findByTripIdAndUserIdAndMemberStatus(tripId,userId,MemberStatus.ACTIVE)
                .map(m -> m.getRole().canEditContent()).orElse(false)) throw error(HttpStatus.FORBIDDEN,"Only the owner or an editor can configure flight tracking");
        if (request.enabled() && !available()) throw error(HttpStatus.SERVICE_UNAVAILABLE,"Flight tracking is not configured yet");
        if (booking.getTransportType() != TransportType.FLIGHT || booking.getBookingSource() == BookingSource.TRIPMATE_SANDBOX
                || booking.getStatus() != BookingStatus.CONFIRMED) throw error(HttpStatus.BAD_REQUEST,"Tracking requires a confirmed, non-demo flight booking");
        ZoneId zone;
        try { zone = ZoneId.of(request.departureZone()); }
        catch (DateTimeException e) { throw error(HttpStatus.BAD_REQUEST,"Enter a valid departure time zone, such as Asia/Kolkata"); }
        if (request.origin().equals(request.destination())) throw error(HttpStatus.BAD_REQUEST,"Departure and arrival airports must differ");
        LocalDate today = LocalDate.now(zone);
        if (request.departureDate().isBefore(today.minusDays(2)) || request.departureDate().isAfter(today.plusYears(1)))
            throw error(HttpStatus.BAD_REQUEST,"Use a departure date from the last two days or within the next year");
        FlightTracking f = tracking.lockById(bookingId).orElseGet(FlightTracking::new);
        String ident = request.airlineCode() + request.flightNumber();
        boolean changed = !Objects.equals(f.getIdent(),ident) || !Objects.equals(f.getDepartureDate(),request.departureDate())
                || !Objects.equals(f.getOrigin(),request.origin()) || !Objects.equals(f.getDestination(),request.destination())
                || !Objects.equals(f.getDepartureZone(),request.departureZone());
        f.setBooking(booking); f.setIdent(ident); f.setAirlineCode(request.airlineCode()); f.setFlightNumber(request.flightNumber()); f.setDepartureDate(request.departureDate());
        f.setOrigin(request.origin()); f.setDestination(request.destination()); f.setDepartureZone(request.departureZone());
        f.setEnabled(request.enabled()); f.setBookingFingerprint(fingerprint(booking));
        var day = request.departureDate().atStartOfDay(zone);
        f.setWindowStart(day.minusHours(6).toInstant()); f.setWindowEnd(day.plusDays(3).toInstant());
        // Preserve throttling across edits and toggles.
        if (f.getNextPoll() == null) f.setNextPoll(Instant.now());
        if (changed) { f.setSnapshot(null); f.setLastChecked(null); f.setProviderFlightId(null); f.setMessage(null); }
        return response(tracking.saveAndFlush(f),userId);
    }

    @Transactional
    public FlightTrackingResponse subscribe(Long tripId, Long bookingId, Long userId, boolean enabled) {
        trips.getTripById(tripId,userId);
        FlightTracking f = tracking.lockById(bookingId).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"Configure this flight first"));
        if (!f.getBooking().getTrip().getId().equals(tripId)) throw error(HttpStatus.NOT_FOUND,"Flight not found");
        var existing = subscriptions.findByTrackingIdAndUserId(bookingId,userId);
        if (enabled && existing.isEmpty()) {
            FlightSubscription sub = new FlightSubscription(); sub.setTracking(f);
            sub.setUser(users.findById(userId).orElseThrow()); subscriptions.save(sub);
        } else if (!enabled) existing.ifPresent(subscriptions::delete);
        return response(f,userId);
    }

    @Transactional
    public void poll(Long id) {
        if (!available()) return;
        FlightTracking f = tracking.lockById(id).orElse(null);
        Instant now = Instant.now();
        if (f == null || !f.isEnabled() || f.getNextPoll().isAfter(now) || f.getWindowStart().isAfter(now) || !f.getWindowEnd().isAfter(now)) return;
        Booking booking = f.getBooking();
        if (booking.getStatus() != BookingStatus.CONFIRMED || booking.getTransportType() != TransportType.FLIGHT
                || booking.getBookingSource() == BookingSource.TRIPMATE_SANDBOX) {
            f.setEnabled(false); f.setMessage("Tracking stopped because this booking is no longer an eligible flight."); return;
        }
        if (!Objects.equals(f.getBookingFingerprint(),fingerprint(booking))) {
            f.setEnabled(false); f.setMessage("Booking details changed. Confirm the flight identity again before tracking."); return;
        }
        // Shared per-booking throttle is persisted and protected by a database lock.
        f.setNextPoll(now.plusSeconds(900));
        if (!budget.reserve()) {
            f.setNextPoll(now.plusSeconds(3600));
            f.setMessage("Daily flight-data allowance reached. Saved details remain available; retrying later."); return;
        }
        FlightProvider.Result result;
        try { result = provider.lookup(f); }
        catch (RuntimeException e) {
            f.setNextPoll(now.plusSeconds(1800));
            f.setMessage("Flight data is temporarily unavailable. Retrying automatically; check with your airline."); return;
        }
        if (result == null) { f.setMessage("No matching flight yet. Verify the airline, date and airports; retrying automatically."); return; }
        FlightSnapshot previous = snapshot(f);
        f.setProviderFlightId(result.flightId()); f.setSnapshot(encode(result.snapshot()));
        f.setLastChecked(now); f.setMessage(null);
        if ((previous != null && !previous.equals(result.snapshot()))
                || (previous == null && Set.of("DELAYED", "CANCELLED", "DIVERTED").contains(result.snapshot().status()))) {
            for (FlightSubscription sub : subscriptions.findByTrackingId(id)) {
                Long userId = sub.getUser().getId();
                if (booking.getTrip().getOwner().getId().equals(userId)
                        || members.existsByTripIdAndUserIdAndMemberStatus(booking.getTrip().getId(),userId,MemberStatus.ACTIVE)) {
                    notifications.createAndSendNotification(sub.getUser(),booking.getTrip(),"Flight update: " + f.getIdent(),
                            summary(f,result.snapshot()),NotificationType.FLIGHT_UPDATED);
                }
            }
        }
    }

    static String fingerprint(Booking booking) {
        String value = String.join("|", Objects.toString(booking.getProviderName(),""), Objects.toString(booking.getStartDatetime(),""),
                Objects.toString(booking.getEndDatetime(),""), Objects.toString(booking.getDeparture(),""), Objects.toString(booking.getArrival(),""));
        try { return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    private String summary(FlightTracking f, FlightSnapshot s) {
        String departure = s.estimatedDeparture() == null ? "unavailable" : s.estimatedDeparture().atZone(ZoneId.of(f.getDepartureZone())).toString();
        return f.getIdent() + " " + f.getOrigin() + "–" + f.getDestination() + ": " + s.status()
                + ". Estimated departure: " + departure + ". Gate: " + Objects.toString(s.departureGate(),"unavailable")
                + ". Terminal: " + Objects.toString(s.departureTerminal(),"unavailable")
                + ". Open the trip for arrival details. Source: FlightAware.";
    }

    private FlightTrackingResponse response(FlightTracking f, Long userId) {
        boolean stale = f.getLastChecked() == null || f.getLastChecked().isBefore(Instant.now().minusSeconds(1800));
        String message = !available() ? "Live flight tracking is not configured." : !f.isEnabled() ? "Tracking is paused."
                : Instant.now().isBefore(f.getWindowStart()) ? "Automatic checks begin the evening before the departure date."
                : Instant.now().isAfter(f.getWindowEnd()) ? "Tracking window ended. These are the last saved details." : f.getMessage();
        if (!Objects.equals(f.getBookingFingerprint(),fingerprint(f.getBooking()))) message = "Booking details changed. Confirm the flight identity again before tracking.";
        return new FlightTrackingResponse(f.getId(),f.getIdent(),f.getAirlineCode(),f.getFlightNumber(),f.getDepartureDate(),f.getOrigin(),f.getDestination(),
                f.getDepartureZone(),f.isEnabled(),subscriptions.existsByTrackingIdAndUserId(f.getId(),userId),
                available(),stale,f.getLastChecked(),f.getNextPoll(),message,"FlightAware",snapshot(f));
    }
    private FlightSnapshot snapshot(FlightTracking f) {
        if (f.getSnapshot() == null) return null;
        try { return json.readValue(f.getSnapshot(),FlightSnapshot.class); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Stored flight data could not be read",e); }
    }
    private String encode(FlightSnapshot snapshot) {
        try { return json.writeValueAsString(snapshot); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Flight data could not be saved",e); }
    }
    private ResponseStatusException error(HttpStatus status, String message) { return new ResponseStatusException(status,message); }
}

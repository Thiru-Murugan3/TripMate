package com.tripmate.flight;

import java.time.*;

public record FlightTrackingResponse(Long bookingId, String ident, String airlineCode, String flightNumber, LocalDate departureDate,
        String origin, String destination, String departureZone, boolean enabled, boolean subscribed,
        boolean available, boolean stale, Instant lastChecked, Instant nextPoll, String message,
        String source, FlightSnapshot snapshot) {}

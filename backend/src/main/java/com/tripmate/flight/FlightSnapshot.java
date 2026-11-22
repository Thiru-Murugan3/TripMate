package com.tripmate.flight;

import java.time.Instant;

public record FlightSnapshot(String status, Instant scheduledDeparture, Instant estimatedDeparture,
        Instant actualDeparture, Instant scheduledArrival, Instant estimatedArrival, Instant actualArrival,
        String departureGate, String arrivalGate, String departureTerminal, String arrivalTerminal) {}

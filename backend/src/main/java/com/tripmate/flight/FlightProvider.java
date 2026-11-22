package com.tripmate.flight;

public interface FlightProvider {
    boolean available();
    Result lookup(FlightTracking flight);
    record Result(String flightId, FlightSnapshot snapshot) {}
}

package com.tripmate.flight;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

class FlightAwareProviderTest {
    final ObjectMapper json = new ObjectMapper();
    FlightTracking flight() {
        var f = new FlightTracking(); f.setIdent("AI101"); f.setOrigin("DEL"); f.setDestination("BOM");
        f.setDepartureZone("Asia/Kolkata"); f.setDepartureDate(LocalDate.of(2026,10,14)); return f;
    }
    String row(String id, String departure, String extra) {
        return """
                {"fa_flight_id":"%s", "ident":"AIC101", "ident_iata":"AI101",
                 "origin":{"code_iata":"DEL"},"destination":{"code_iata":"BOM"},
                 "scheduled_out":"%s" %s}
                """.formatted(id,departure,extra);
    }
    @Test void matchesDepartureLocalDateRatherThanUtcDate() throws Exception {
        var result = FlightAwareProvider.select(json.readTree("{\"flights\":[" + row("correct","2026-10-13T20:00:00Z","") + ","
                + row("wrong-day","2026-10-14T20:00:00Z","") + "]}"),flight());
        assertEquals("correct",result.flightId());
        assertNull(result.snapshot().departureGate());
    }
    @Test void refusesAmbiguousOrIncompleteResults() throws Exception {
        var node = json.readTree("{\"flights\":[" + row("one","2026-10-14T02:00:00Z","") + "," + row("two","2026-10-14T03:00:00Z","") + "]}");
        assertThrows(IllegalStateException.class,() -> FlightAwareProvider.select(node,flight()));
        var paged = json.readTree("{\"links\":{\"next\":\"more\"},\"flights\":[" + row("one","2026-10-14T02:00:00Z","") + "]}");
        assertThrows(IllegalStateException.class,() -> FlightAwareProvider.select(paged,flight()));
    }
    @Test void rejectsWrongRouteAndPreservesCancellationAndGates() throws Exception {
        var data = json.readTree("{\"flights\":[" + row("one","2026-10-14T02:00:00Z",",\"cancelled\":true,\"gate_origin\":\"42\",\"terminal_origin\":\"3\"") + "]}");
        var result = FlightAwareProvider.select(data,flight());
        assertEquals("CANCELLED",result.snapshot().status()); assertEquals("42",result.snapshot().departureGate());
        var wrong = flight(); wrong.setDestination("MAA"); assertNull(FlightAwareProvider.select(data,wrong));
    }
    @Test void pinsProviderIdentityInsteadOfSwitchingFlights() throws Exception {
        var requested = flight(); requested.setProviderFlightId("pinned");
        var data = json.readTree("{\"flights\":[" + row("other","2026-10-14T02:00:00Z","") + "]}");
        assertNull(FlightAwareProvider.select(data,requested));
    }
    @Test void disabledProviderMakesNoCall() {
        var provider = new FlightAwareProvider(false,"test");
        assertFalse(provider.available()); assertThrows(IllegalStateException.class,() -> provider.lookup(flight()));
        assertFalse(new FlightAwareProvider(true,"").available());
    }

    @Test void detectsRunwayDelayWithoutMislabelingGateTimes() throws Exception {
        var data = json.readTree("""
                {"flights":[{"fa_flight_id":"one","ident_iata":"AI101",
                "origin":{"code_iata":"DEL"},"destination":{"code_iata":"BOM"},
                "scheduled_off":"2026-10-14T02:00:00Z","estimated_off":"2026-10-14T03:00:00Z"}]}
                """);
        var result = FlightAwareProvider.select(data,flight());
        assertEquals("DELAYED",result.snapshot().status());
        assertNull(result.snapshot().scheduledDeparture());
        assertNull(result.snapshot().estimatedDeparture());
    }
}

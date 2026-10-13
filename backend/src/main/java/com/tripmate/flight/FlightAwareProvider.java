package com.tripmate.flight;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.time.*;
import java.util.*;

@Component
public class FlightAwareProvider implements FlightProvider {
    private final RestClient client;
    private final boolean enabled;
    private final String apiKey;

    public FlightAwareProvider(@Value("${flight-alerts.enabled:false}") boolean enabled,
            @Value("${flight-alerts.api-key:}") String apiKey) {
        this.enabled = enabled;
        this.apiKey = apiKey;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000); factory.setReadTimeout(10000);
        this.client = RestClient.builder().baseUrl("https://aeroapi.flightaware.com/aeroapi")
                .requestFactory(factory).defaultHeader("x-apikey", apiKey).build();
    }
    public boolean available() { return enabled && !apiKey.isBlank(); }

    public Result lookup(FlightTracking flight) {
        if (!available()) throw new IllegalStateException("Flight tracking is not configured");
        String id = flight.getProviderFlightId() != null ? flight.getProviderFlightId() : flight.getIdent();
        JsonNode data = client.get().uri(builder -> {
            var uri = builder.path("/flights/{ident}").queryParam("max_pages", 1)
                    .queryParam("ident_type", flight.getProviderFlightId() == null ? "designator" : "fa_flight_id");
            if (flight.getProviderFlightId() == null) {
                var day = flight.getDepartureDate().atStartOfDay(ZoneId.of(flight.getDepartureZone()));
                uri.queryParam("start", day.toInstant().toString()).queryParam("end", day.plusDays(1).toInstant().toString());
            }
            return uri.build(id);
        }).retrieve().body(JsonNode.class);
        return select(data, flight);
    }

    // Never guess between recurring flights, codeshares, or multiple matching legs.
    static Result select(JsonNode data, FlightTracking requested) {
        if (data == null || !data.path("flights").isArray()) throw new IllegalStateException("Invalid flight response");
        List<JsonNode> matches = new ArrayList<>();
        for (JsonNode f : data.path("flights")) {
            if (requested.getProviderFlightId() != null) {
                if (requested.getProviderFlightId().equals(text(f,"fa_flight_id"))) matches.add(f);
            } else {
                Instant departure = time(f,"scheduled_out");
                if (departure == null) departure = time(f,"scheduled_off");
                boolean ident = List.of("ident", "ident_iata", "ident_icao").stream()
                        .anyMatch(key -> requested.getIdent().equals(text(f,key)));
                if (ident && airport(f.path("origin"), requested.getOrigin())
                        && airport(f.path("destination"), requested.getDestination()) && departure != null
                        && departure.atZone(ZoneId.of(requested.getDepartureZone())).toLocalDate().equals(requested.getDepartureDate())) matches.add(f);
            }
        }
        if (matches.isEmpty()) return null;
        if (matches.size() != 1) throw new IllegalStateException("Multiple matching flight legs; confirm the flight with the airline");
        // An incomplete page cannot establish an unambiguous match.
        if (data.path("links").hasNonNull("next")) throw new IllegalStateException("Incomplete flight results");
        JsonNode f = matches.getFirst();
        String id = text(f,"fa_flight_id");
        if (id == null) throw new IllegalStateException("Missing provider flight identity");
        Instant out = time(f,"scheduled_out"), estimatedOut = time(f,"estimated_out");
        String status = f.path("cancelled").asBoolean() ? "CANCELLED" : f.path("diverted").asBoolean() ? "DIVERTED"
                : time(f,"actual_in") != null || time(f,"actual_on") != null ? "ARRIVED"
                : time(f,"actual_out") != null || time(f,"actual_off") != null ? "DEPARTED"
                : out != null && estimatedOut != null && estimatedOut.isAfter(out.plusSeconds(300)) ? "DELAYED" : "SCHEDULED";
        return new Result(id, new FlightSnapshot(status, out, estimatedOut, time(f,"actual_out"),
                time(f,"scheduled_in"), time(f,"estimated_in"), time(f,"actual_in"),
                text(f,"gate_origin"), text(f,"gate_destination"), text(f,"terminal_origin"), text(f,"terminal_destination")));
    }
    private static boolean airport(JsonNode airport, String code) {
        return List.of("code", "code_iata", "code_icao").stream().anyMatch(key -> code.equals(text(airport,key)));
    }
    private static String text(JsonNode f, String key) {
        return f.hasNonNull(key) && !f.path(key).asText().isBlank() ? f.path(key).asText() : null;
    }
    private static Instant time(JsonNode f, String key) {
        String value = text(f,key); return value == null ? null : Instant.parse(value);
    }
}

package com.tripmate.flight;

import com.tripmate.booking.Booking;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;

@Entity @Table(name="flight_tracking") @Getter @Setter @NoArgsConstructor
public class FlightTracking {
    @Id @Column(name="booking_id") private Long id;
    @MapsId @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="booking_id") private Booking booking;
    private String ident;
    private String airlineCode;
    private String flightNumber;
    private LocalDate departureDate;
    private String origin;
    private String destination;
    private String departureZone;
    private boolean enabled;
    private Instant windowStart;
    private Instant windowEnd;
    private Instant nextPoll;
    private Instant lastChecked;
    private String providerFlightId;
    private String bookingFingerprint;
    @Column(columnDefinition="TEXT") private String snapshot;
    private String message;
}

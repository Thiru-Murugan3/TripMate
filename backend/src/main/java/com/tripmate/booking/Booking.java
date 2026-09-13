package com.tripmate.booking;

import com.tripmate.trip.Trip;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Enumerated(EnumType.STRING)
    @Column(name = "booking_type", nullable = false, length = 30)
    private BookingType bookingType;

    @Enumerated(EnumType.STRING)
    @Column(name = "transport_type", length = 30)
    private TransportType transportType;

    @Column(name = "provider_name", nullable = false, length = 180)
    private String providerName;

    @Column(name = "booking_reference", length = 120)
    private String bookingReference;

    @Column(name = "start_datetime")
    private LocalDateTime startDatetime;

    @Column(name = "end_datetime")
    private LocalDateTime endDatetime;

    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private BookingStatus status = BookingStatus.CONFIRMED;

    @Column(columnDefinition = "TEXT")
    private String notes;
}

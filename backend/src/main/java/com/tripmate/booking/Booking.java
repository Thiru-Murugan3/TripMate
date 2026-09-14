package com.tripmate.booking;

import com.tripmate.trip.Trip;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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

    @Column(length = 180)
    private String departure;

    @Column(length = 180)
    private String arrival;

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

    @Enumerated(EnumType.STRING)
    @Column(name = "booking_source", nullable = false, length = 30)
    @Builder.Default
    private BookingSource bookingSource = BookingSource.EXTERNAL_MANUAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 20)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.NOT_REQUIRED;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "INR";

    @Column(name = "provider_offer_id", length = 120)
    private String providerOfferId;

    @Column(name = "traveler_name", length = 120)
    private String travelerName;

    @Column(name = "traveler_email", length = 180)
    private String travelerEmail;

    @Column(name = "traveler_mobile", length = 20)
    private String travelerMobile;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("travelerOrder ASC, id ASC")
    @Builder.Default
    private List<BookingTraveler> travelers = new ArrayList<>();
}

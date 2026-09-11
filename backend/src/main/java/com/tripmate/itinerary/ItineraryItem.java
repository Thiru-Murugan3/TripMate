package com.tripmate.itinerary;

import com.tripmate.place.Place;
import com.tripmate.trip.Trip;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalTime;

@Entity
@Table(name = "itinerary_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItineraryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "day_id", nullable = false)
    private ItineraryDay itineraryDay;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "place_id")
    private Place place;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(length = 255)
    private String location;

    @Column(name = "estimated_cost", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal estimatedCost = BigDecimal.ZERO;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;
}

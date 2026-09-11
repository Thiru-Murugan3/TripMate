package com.tripmate.itinerary;

import com.tripmate.trip.Trip;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "itinerary_days", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"trip_id", "day_number"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItineraryDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Column(name = "day_number", nullable = false)
    private Integer dayNumber;

    @Column(name = "day_date")
    private LocalDate dayDate;

    @Column(length = 180)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "itineraryDay", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    @Builder.Default
    private List<ItineraryItem> items = new ArrayList<>();
}

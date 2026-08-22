package com.tripmate.trip;
import com.tripmate.user.User;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
@Entity
@Table(name="trips")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Trip {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="owner_id",nullable=false) private User owner;
    @Column(nullable=false,length=160) private String name;
    @Column(nullable=false,length=180) private String destination;
    @Enumerated(EnumType.STRING) @Column(name="trip_type",nullable=false,length=20) private TripType tripType;
    @Column(name="start_date",nullable=false) private LocalDate startDate;
    @Column(name="end_date",nullable=false) private LocalDate endDate;
    @Column(name="traveler_count",nullable=false) @Builder.Default private Integer travelerCount=1;
    @Column(nullable=false,precision=12,scale=2) @Builder.Default private BigDecimal budget=BigDecimal.ZERO;
    @Column(columnDefinition="TEXT") private String description;
    @Column(name="cover_image_url",length=500) private String coverImageUrl;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) @Builder.Default private TripStatus status=TripStatus.PLANNED;
    @Column(name="created_at",nullable=false,insertable=false,updatable=false) private LocalDateTime createdAt;
    @Column(name="updated_at",nullable=false,insertable=false,updatable=false) private LocalDateTime updatedAt;
}

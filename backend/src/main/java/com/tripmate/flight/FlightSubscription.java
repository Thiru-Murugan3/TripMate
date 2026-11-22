package com.tripmate.flight;

import com.tripmate.user.User;
import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name="flight_subscriptions", uniqueConstraints=@UniqueConstraint(columnNames={"booking_id","user_id"}))
@Getter @Setter @NoArgsConstructor
public class FlightSubscription {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="booking_id") private FlightTracking tracking;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="user_id") private User user;
}

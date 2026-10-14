package com.tripmate.flight;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface FlightSubscriptionRepository extends JpaRepository<FlightSubscription,Long> {
    List<FlightSubscription> findByTrackingId(Long id);
    Optional<FlightSubscription> findByTrackingIdAndUserId(Long id, Long userId);
    boolean existsByTrackingIdAndUserId(Long id, Long userId);
}

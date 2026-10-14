package com.tripmate.flight;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.Pageable;
import java.time.Instant;
import java.util.*;

public interface FlightTrackingRepository extends JpaRepository<FlightTracking,Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select f from FlightTracking f where f.id = :id")
    Optional<FlightTracking> lockById(Long id);
    List<FlightTracking> findByBookingTripId(Long tripId);
    @Query("select f.id from FlightTracking f where f.enabled = true and f.windowStart <= :now and f.windowEnd > :now and f.nextPoll <= :now order by f.nextPoll, f.id")
    List<Long> due(Instant now, Pageable page);
}

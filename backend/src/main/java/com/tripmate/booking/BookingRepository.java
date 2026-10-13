package com.tripmate.booking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select b from Booking b where b.id = :id and b.trip.id = :tripId")
    Optional<Booking> lockForFlightTracking(Long id, Long tripId);

    List<Booking> findByTripIdOrderByStartDatetimeAscIdDesc(Long tripId);

    Optional<Booking> findByIdAndTripId(Long id, Long tripId);
}

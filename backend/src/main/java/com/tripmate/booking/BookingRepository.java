package com.tripmate.booking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByTripIdOrderByStartDatetimeAscIdDesc(Long tripId);

    Optional<Booking> findByIdAndTripId(Long id, Long tripId);
}

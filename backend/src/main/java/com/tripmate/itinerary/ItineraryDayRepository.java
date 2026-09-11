package com.tripmate.itinerary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ItineraryDayRepository extends JpaRepository<ItineraryDay, Long> {

    List<ItineraryDay> findByTripIdOrderByDayNumberAsc(Long tripId);

    Optional<ItineraryDay> findByIdAndTripId(Long id, Long tripId);

    boolean existsByTripIdAndDayNumber(Long tripId, Integer dayNumber);
}

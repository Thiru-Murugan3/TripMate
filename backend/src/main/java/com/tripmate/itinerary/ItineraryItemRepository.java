package com.tripmate.itinerary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ItineraryItemRepository extends JpaRepository<ItineraryItem, Long> {

    List<ItineraryItem> findByItineraryDayIdOrderByDisplayOrderAscIdAsc(Long dayId);

    Optional<ItineraryItem> findByIdAndTripId(Long id, Long tripId);

    List<ItineraryItem> findByTripIdOrderByItineraryDayDayNumberAscDisplayOrderAscIdAsc(Long tripId);
}

package com.tripmate.place;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlaceRepository extends JpaRepository<Place, Long> {

    List<Place> findByTripIdOrderByIdAsc(Long tripId);

    Optional<Place> findByIdAndTripId(Long id, Long tripId);
}

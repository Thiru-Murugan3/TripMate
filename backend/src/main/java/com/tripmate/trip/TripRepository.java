package com.tripmate.trip;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TripRepository extends JpaRepository<Trip, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select t from Trip t where t.id = :id")
    Optional<Trip> findForImportById(@org.springframework.data.repository.query.Param("id") Long id);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select t from Trip t where t.id = :id")
    Optional<Trip> findForPlanningById(@org.springframework.data.repository.query.Param("id") Long id);

    List<Trip> findByOwnerIdOrderByStartDateDesc(Long ownerId);

    Optional<Trip> findByIdAndOwnerId(Long id, Long ownerId);
}

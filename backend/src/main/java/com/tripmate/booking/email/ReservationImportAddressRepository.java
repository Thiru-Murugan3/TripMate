package com.tripmate.booking.email;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReservationImportAddressRepository extends JpaRepository<ReservationImportAddress, Long> {
    Optional<ReservationImportAddress> findByUserId(Long userId);
    Optional<ReservationImportAddress> findByImportTokenAndEnabledTrue(String importToken);
}

package com.tripmate.booking.email;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReservationEmailImportRepository extends JpaRepository<ReservationEmailImport, Long> {
    boolean existsByMessageId(String messageId);
    List<ReservationEmailImport> findByUserIdOrderByReceivedAtDesc(Long userId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<ReservationEmailImport> findByIdAndUserId(Long id, Long userId);
}

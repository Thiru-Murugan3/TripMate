package com.tripmate.document;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    List<Document> findByTripIdOrderByCreatedAtDesc(Long tripId);

    Optional<Document> findByIdAndTripId(Long id, Long tripId);
}

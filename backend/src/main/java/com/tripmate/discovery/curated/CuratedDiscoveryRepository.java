package com.tripmate.discovery.curated;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CuratedDiscoveryRepository extends JpaRepository<CuratedDiscoveryItem, Long> {
    @EntityGraph(attributePaths = {"prices", "images"})
    List<CuratedDiscoveryItem> findByEnabledTrue();

    @Override
    @EntityGraph(attributePaths = {"prices", "images"})
    Optional<CuratedDiscoveryItem> findById(Long id);

    @EntityGraph(attributePaths = {"prices", "images"})
    Optional<CuratedDiscoveryItem> findByExternalId(String externalId);

    @EntityGraph(attributePaths = {"prices", "images"})
    List<CuratedDiscoveryItem> findByConflictStatusIsNotNull();
}

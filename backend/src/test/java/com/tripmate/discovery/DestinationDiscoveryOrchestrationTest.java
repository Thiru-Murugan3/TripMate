package com.tripmate.discovery;

import com.tripmate.discovery.curated.CuratedDiscoveryMapper;
import com.tripmate.discovery.curated.CuratedDiscoveryRepository;
import com.tripmate.discovery.provider.*;
import com.tripmate.place.PlaceCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DestinationDiscoveryOrchestrationTest {
    private DestinationGeocodingService geocoding;
    private DiscoveryProvider primary;
    private DiscoveryProvider fallback;
    private DestinationDiscoveryService service;

    @BeforeEach
    void setUp() {
        geocoding = mock(DestinationGeocodingService.class);
        primary = mock(DiscoveryProvider.class);
        fallback = mock(DiscoveryProvider.class);
        when(primary.name()).thenReturn("Primary");
        when(fallback.name()).thenReturn("Fallback");
        when(geocoding.geocode(anyString())).thenReturn(new GeocodedDestination(
                new BigDecimal("13.0827"), new BigDecimal("80.2707"),
                "Chennai, Tamil Nadu, India", "Chennai", "Chennai", "Tamil Nadu", "IN", "Nominatim"
        ));
        service = new DestinationDiscoveryService(geocoding, List.of(primary, fallback),
                mock(CuratedDiscoveryRepository.class), mock(CuratedDiscoveryMapper.class), 6, 60, 200);
    }

    @Test
    void providerFailureReturnsVerifiedPartialResultsWithWarning() {
        when(primary.discover(any())).thenThrow(new RuntimeException("provider down"));
        when(fallback.discover(any())).thenReturn(result("Fallback", place("Marina Beach", 3, null, DiscoveryCategory.BEACH)));

        DestinationDiscoveryResponse response = service.search("Chennai", 25, "ALL");

        assertEquals(1, response.resultCount());
        assertEquals(List.of("Fallback"), response.providersUsed());
        assertTrue(response.warnings().stream().anyMatch(message -> message.contains("Primary was unavailable")));
        assertTrue(response.warnings().stream().anyMatch(message -> message.contains("Confirm with")));
    }

    @Test
    void deduplicatesMatchingProviderRecordsByNameAndCoordinate() {
        when(primary.discover(any())).thenReturn(result("Primary", place("Government Museum", 2, null, DiscoveryCategory.MUSEUM)));
        when(fallback.discover(any())).thenReturn(result("Fallback", new DiscoveredPlace(
                "fallback:2", "Government Museum", DiscoveryCategory.MUSEUM,
                new BigDecimal("13.0828"), new BigDecimal("80.2708"), 2.1, 90,
                "Same real museum", null, null, null, PlaceCategory.ATTRACTION, null, null
        )));

        assertEquals(1, service.search("Chennai", 25, "ALL").resultCount());
    }

    @Test
    void filtersSortsAndPaginatesWithoutTreatingUnknownAsFree() {
        when(primary.discover(any())).thenReturn(new DiscoveryProviderResult("Primary", "Attribution", List.of(
                place("Unknown Entry", 1, null, DiscoveryCategory.ATTRACTION),
                place("Paid Fort", 5, new BigDecimal("100"), DiscoveryCategory.HISTORICAL),
                place("Paid Museum", 3, new BigDecimal("50"), DiscoveryCategory.MUSEUM)
        ), List.of()));
        when(fallback.discover(any())).thenReturn(result("Fallback"));
        DiscoverySearchFilters filters = new DiscoverySearchFilters(
                "ALL", null, "PLACE", new BigDecimal("1"), new BigDecimal("100"),
                null, null, null, null, null, null, null, "PRICE_LOW", 0, 1
        );

        DestinationDiscoveryResponse response = service.search("Chennai", 25, filters);

        assertEquals(2, response.resultCount());
        assertEquals(1, response.places().size());
        assertEquals("Paid Museum", response.places().getFirst().name());
        assertEquals(2, response.totalPages());
        assertEquals("PRICE_LOW", response.appliedFilters().get("sort"));
    }

    @Test
    void cachesIdenticalGeocodingAndProviderSearches() {
        when(primary.discover(any())).thenReturn(result("Primary", place("Kapaleeshwarar Temple", 4, null, DiscoveryCategory.TEMPLE)));
        when(fallback.discover(any())).thenReturn(result("Fallback"));

        service.search("Chennai", 25, "ALL");
        service.search("Chennai", 25, "ALL");

        verify(geocoding, times(1)).geocode("Chennai");
        verify(primary, times(1)).discover(any());
    }

    @Test
    void committedCatalogueChangeInvalidatesSearchAndProviderDetails() {
        var old = place("Old", 1, null, DiscoveryCategory.MUSEUM);
        when(primary.discover(any())).thenReturn(result("Primary", old), result("Primary"));
        when(fallback.discover(any())).thenReturn(result("Fallback"));
        service.search("Chennai", 25, "ALL");
        assertEquals(old, service.findByExternalId(old.externalId()));
        service.catalogueChanged(new DiscoveryCatalogueChanged());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.findByExternalId(old.externalId()));
        assertEquals(0, service.search("Chennai", 25, "ALL").resultCount());
        verify(primary, times(2)).discover(any());
    }

    @Test
    void inFlightSearchCannotRepopulateInvalidatedGeneration() {
        when(primary.discover(any())).thenAnswer(invocation -> {
            service.catalogueChanged(new DiscoveryCatalogueChanged());
            return result("Primary", place("Old", 1, null, DiscoveryCategory.MUSEUM));
        }).thenReturn(result("Primary"));
        when(fallback.discover(any())).thenReturn(result("Fallback"));
        service.search("Chennai", 25, "ALL");
        assertEquals(0, service.search("Chennai", 25, "ALL").resultCount());
        verify(primary, times(2)).discover(any());
    }

    @Test
    void disabledCuratedListingIsNeverReturnedByDirectLookup() {
        var repository = mock(CuratedDiscoveryRepository.class);
        var item = new com.tripmate.discovery.curated.CuratedDiscoveryItem();
        item.setEnabled(false);
        when(repository.findByExternalId("curated:disabled")).thenReturn(java.util.Optional.of(item));
        var service = new DestinationDiscoveryService(geocoding, List.of(), repository,
                mock(CuratedDiscoveryMapper.class), 6, 60, 200);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.findByExternalId("curated:disabled"));
    }

    @Test
    void verifiedFilterExcludesExpiredFees() {
        var item = new com.tripmate.discovery.curated.CuratedDiscoveryItem();
        item.setExternalId("curated:expired"); item.setName("Expired Fort");
        item.setCategory(DiscoveryCategory.HISTORICAL); item.setItemType(DiscoveryItemType.PLACE);
        item.setLatitude(new BigDecimal("13")); item.setLongitude(new BigDecimal("80"));
        item.setPriceStatus(PriceStatus.VERIFIED); item.setBasePrice(new BigDecimal("50"));
        item.setVerificationExpiresAt(java.time.Instant.now().minusSeconds(1));
        var expired = new CuratedDiscoveryMapper().toDiscoveredPlace(item, 0, null);
        when(primary.discover(any())).thenReturn(result("Primary", expired));
        when(fallback.discover(any())).thenReturn(result("Fallback"));
        var filters = new DiscoverySearchFilters("ALL", null, null, null, null, "VERIFIED",
                null, null, null, null, null, null, "RELEVANCE", 0, 24);
        assertEquals(0, service.search("Chennai", 25, filters).resultCount());
    }

    @Test
    void springInvalidatesOnlyAfterCommitAndKeepsCacheOnRollback() {
        var old = place("Old", 1, null, DiscoveryCategory.MUSEUM);
        when(primary.discover(any())).thenReturn(result("Primary", old));
        when(fallback.discover(any())).thenReturn(result("Fallback"));
        try (var context = new org.springframework.context.annotation.AnnotationConfigApplicationContext()) {
            context.registerBean(org.springframework.transaction.event.TransactionalEventListenerFactory.class);
            context.registerBean(DestinationDiscoveryService.class, () -> service);
            context.refresh();
            service.search("Chennai", 25, "ALL");
            for (int status : new int[]{1, 0}) { // TransactionSynchronization: rolled back, committed
                org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
                org.springframework.transaction.support.TransactionSynchronizationManager.setActualTransactionActive(true);
                try {
                    context.publishEvent(new DiscoveryCatalogueChanged());
                    assertEquals(old, service.findByExternalId(old.externalId()));
                    for (var synchronization : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations())
                        synchronization.afterCompletion(status);
                } finally {
                    org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
                    org.springframework.transaction.support.TransactionSynchronizationManager.setActualTransactionActive(false);
                }
                if (status == 1) assertEquals(old, service.findByExternalId(old.externalId()));
                else assertThrows(org.springframework.web.server.ResponseStatusException.class,
                        () -> service.findByExternalId(old.externalId()));
            }
        }
    }

    private DiscoveryProviderResult result(String name, DiscoveredPlace... places) {
        return new DiscoveryProviderResult(name, name + " attribution", List.of(places), List.of());
    }

    private DiscoveredPlace place(String name, double distance, BigDecimal price, DiscoveryCategory category) {
        return new DiscoveredPlace(
                "test:" + name.toLowerCase().replace(' ', '-'), name, category,
                new BigDecimal("13.0827"), new BigDecimal("80.2707"), distance, 90,
                "Source-backed listing", null, null, "https://example.test/" + name.replace(' ', '-'),
                PlaceCategory.ATTRACTION, price, null
        );
    }
}

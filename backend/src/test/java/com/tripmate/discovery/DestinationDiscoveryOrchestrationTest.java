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

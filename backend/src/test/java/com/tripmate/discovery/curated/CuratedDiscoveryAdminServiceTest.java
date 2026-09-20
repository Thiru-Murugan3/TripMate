package com.tripmate.discovery.curated;

import com.tripmate.discovery.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CuratedDiscoveryAdminServiceTest {
    private CuratedDiscoveryRepository repository;
    private CuratedDiscoveryAdminService service;

    @BeforeEach
    void setUp() {
        repository = mock(CuratedDiscoveryRepository.class);
        when(repository.save(any())).thenAnswer(invocation -> {
            CuratedDiscoveryItem item = invocation.getArgument(0);
            if (item.getId() == null) item.setId(99L);
            return item;
        });
        service = new CuratedDiscoveryAdminService(repository, new CuratedDiscoveryMapper());
    }

    @Test
    void createsTraceableListingWithStructuredPriceAndExactImage() {
        AdminDiscoveryItemResponse response = service.create(request(), 7L);

        assertEquals(99L, response.id());
        assertEquals("curated:test-fort", response.listing().externalId());
        assertEquals(PriceStatus.VERIFIED, response.listing().priceStatus());
        assertEquals("https://tourism.example/fort", response.listing().sourceUrl());
        assertEquals(1, response.listing().priceOptions().size());
        assertTrue(response.listing().imageExact());
        assertEquals(7L, response.createdBy());
    }

    @Test
    void verifyRefreshesExpiryAndClearsProviderConflict() {
        CuratedDiscoveryItem item = itemFrom(request());
        item.setId(12L);
        item.setConflictStatus("PRICE_MISMATCH");
        item.setConflictNotes("OSM and official source differ");
        item.setPriceStatus(PriceStatus.UNKNOWN);
        when(repository.findById(12L)).thenReturn(Optional.of(item));
        Instant checked = Instant.now();
        Instant expires = checked.plus(30, ChronoUnit.DAYS);

        AdminDiscoveryItemResponse response = service.verify(12L, new VerifyDiscoveryItemRequest(checked, expires), 7L);

        assertNull(response.conflictStatus());
        assertEquals(expires, response.listing().verificationExpiresAt());
        assertEquals(7L, response.updatedBy());
    }

    @Test
    void canDisableIncorrectListingWithoutDeletingAuditData() {
        CuratedDiscoveryItem item = itemFrom(request());
        item.setId(12L);
        when(repository.findById(12L)).thenReturn(Optional.of(item));

        AdminDiscoveryItemResponse response = service.setEnabled(12L, false, 7L);

        assertFalse(response.enabled());
        assertEquals("https://tourism.example/fort", response.listing().sourceUrl());
    }

    @Test
    void mapperMarksExpiredFeesAsMayHaveChanged() {
        CuratedDiscoveryItem item = itemFrom(request());
        item.setVerificationExpiresAt(Instant.now().minus(1, ChronoUnit.DAYS));
        item.getPrices().forEach(price -> price.setExpiresAt(Instant.now().minus(1, ChronoUnit.DAYS)));

        DiscoveredPlace place = new CuratedDiscoveryMapper().toDiscoveredPlace(item, 0, null);

        assertTrue(place.verificationExpired());
        assertTrue(place.priceOptions().getFirst().mayHaveChanged());
    }

    private CuratedDiscoveryItem itemFrom(UpsertDiscoveryItemRequest request) {
        service.create(request, 7L);
        ArgumentCaptor<CuratedDiscoveryItem> captor = ArgumentCaptor.forClass(CuratedDiscoveryItem.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    private UpsertDiscoveryItemRequest request() {
        Instant checked = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant expires = checked.plus(30, ChronoUnit.DAYS);
        return new UpsertDiscoveryItemRequest(
                "curated:test-fort", "Test Fort", DiscoveryItemType.PLACE, DiscoveryCategory.HISTORICAL,
                "Fort", "Jaipur", "Jaipur", "Rajasthan", "Test Road, Jaipur",
                new BigDecimal("26.9124"), new BigDecimal("75.7873"), "Historic fort", "Verified description",
                "09:00-17:00", 120, "October to March", 120, null, null, null, null,
                null, "Follow posted guidance", List.of("Entry"), List.of(), List.of("Water"),
                "Contact venue", "+91 10000 00000", "https://tourism.example/fort", null, null,
                PriceStatus.VERIFIED, PriceType.PER_PERSON, "INR", new BigDecimal("50"),
                "Official Tourism", "https://tourism.example/fort", checked, expires, new BigDecimal("0.950"),
                null, null, 50, true, null, null, true,
                List.of(new UpsertDiscoveryItemRequest.PriceRequest("Adult", new BigDecimal("50"), null,
                        PriceType.PER_PERSON, "INR", PriceStatus.VERIFIED,
                        "https://tourism.example/fort", checked, expires)),
                List.of(new UpsertDiscoveryItemRequest.ImageRequest("https://images.example/fort.jpg",
                        "https://commons.example/fort", "Wikimedia Commons", "Author", "CC BY-SA 4.0",
                        "Author / CC BY-SA 4.0", true, true))
        );
    }
}

package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripmate.discovery.provider.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class DestinationDiscoveryServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private OverpassDiscoveryProvider provider;
    private DiscoveryProviderRequest chennai;

    @BeforeEach
    void setUp() {
        provider = new OverpassDiscoveryProvider(
                new ProviderHttpClientFactory("TripMate-Test/1.0", 1000, 3000),
                new PriceVerificationService(30), new ImageResolverService(),
                mock(WikimediaEnrichmentService.class),
                "https://overpass.example.test/api/interpreter", 200
        );
        chennai = new DiscoveryProviderRequest("Chennai",
                new GeocodedDestination(new BigDecimal("13.0827"), new BigDecimal("80.2707"),
                        "Chennai, Tamil Nadu, India", "Chennai", "Chennai", "Tamil Nadu", "IN", "Test"), 10, null);
    }

    @Test
    void classifiesCompleteCatalogueCategories() throws Exception {
        assertEquals(DiscoveryCategory.BEACH, provider.classify(tags("natural", "beach"), "Marina Beach"));
        assertEquals(DiscoveryCategory.RIVER, provider.classify(tags("waterway", "river"), "Adyar River"));
        assertEquals(DiscoveryCategory.NIGHTLIFE, provider.classify(tags("amenity", "nightclub"), "City Club"));
        assertEquals(DiscoveryCategory.WELLNESS, provider.classify(tags("leisure", "spa"), "City Spa"));
        assertEquals(DiscoveryCategory.TRANSPORT, provider.classify(tags("amenity", "car_rental"), "Car Hire"));
        assertEquals(DiscoveryCategory.CULTURAL, provider.classify(tags("amenity", "theatre"), "City Theatre"));
        assertEquals(DiscoveryCategory.EVENT, provider.classify(tags("event", "festival"), "Music Festival"));
    }

    @Test
    void queryCoversTravelCatalogueWithoutGeneratedListings() {
        String query = provider.buildQuery(13.0827, 80.2707, 25000, null);
        assertTrue(query.contains("around:25000,13.0827,80.2707"));
        assertTrue(query.contains("nightclub"));
        assertTrue(query.contains("travel_agent"));
        assertTrue(query.contains("events_venue"));
        assertFalse(query.contains("Thrill Factory"));
    }

    @Test
    void missingPriceAndImageStayUnknown() throws Exception {
        DiscoveredPlace place = provider.map(response("""
                {"type":"node","id":101,"lat":13.083,"lon":80.271,
                 "tags":{"name":"Real Museum","tourism":"museum"}}
                """), chennai).getFirst();
        assertEquals(PriceStatus.UNKNOWN, place.priceStatus());
        assertNull(place.estimatedCostPerPerson());
        assertNull(place.primaryImageUrl());
        assertFalse(place.imageExact());
        assertEquals("osm:node:101", place.externalId());
    }

    @Test
    void freeRequiresExplicitSourceDeclaration() throws Exception {
        DiscoveredPlace place = provider.map(response("""
                {"type":"node","id":102,"lat":13.083,"lon":80.271,
                 "tags":{"name":"Free Park","leisure":"park","fee":"no"}}
                """), chennai).getFirst();
        assertEquals(PriceStatus.FREE, place.priceStatus());
        assertEquals(new BigDecimal("0.00"), place.estimatedCostPerPerson());
        assertNotNull(place.verificationExpiresAt());
        assertEquals("https://www.openstreetmap.org/node/102", place.priceOptions().getFirst().sourceUrl());
    }

    @Test
    void sourceListedChargeIsEstimatedAndTraceable() throws Exception {
        DiscoveredPlace place = provider.map(response("""
                {"type":"node","id":103,"lat":13.083,"lon":80.271,
                 "tags":{"name":"Paid Museum","tourism":"museum","fee":"yes","charge":"INR 50 per person"}}
                """), chennai).getFirst();
        assertEquals(PriceStatus.ESTIMATED, place.priceStatus());
        assertEquals(new BigDecimal("50.00"), place.estimatedCostPerPerson());
        assertEquals(PriceType.PER_PERSON, place.priceType());
        assertNotNull(place.sourceLastCheckedAt());
    }

    @Test
    void rejectsCoordinatesOutsideIndiaAndRadius() throws Exception {
        JsonNode response = objectMapper.readTree("""
                {"elements":[
                  {"type":"node","id":201,"lat":51.5,"lon":-0.1,"tags":{"name":"London Place","tourism":"attraction"}},
                  {"type":"node","id":202,"lat":12.0,"lon":78.0,"tags":{"name":"Far Place","tourism":"attraction"}}
                ]}
                """);
        assertTrue(provider.map(response, chennai).isEmpty());
    }

    @Test
    void deduplicatesSameNameAtNearbyCoordinates() throws Exception {
        JsonNode response = objectMapper.readTree("""
                {"elements":[
                  {"type":"node","id":301,"lat":13.08301,"lon":80.27101,"tags":{"name":"City Museum","tourism":"museum"}},
                  {"type":"way","id":302,"center":{"lat":13.08302,"lon":80.27102},"tags":{"name":"City Museum","tourism":"museum"}}
                ]}
                """);
        assertEquals(1, provider.map(response, chennai).size());
    }

    @Test
    void preservesExactWikimediaImageAttribution() throws Exception {
        DiscoveredPlace place = provider.map(response("""
                {"type":"node","id":401,"lat":13.083,"lon":80.271,
                 "tags":{"name":"Exact Monument","historic":"monument","wikimedia_commons":"File:Exact Monument.jpg"}}
                """), chennai).getFirst();
        assertTrue(place.imageExact());
        assertEquals("Wikimedia Commons", place.imageSource());
        assertTrue(place.primaryImageUrl().contains("Special:FilePath"));
        assertNotNull(place.imageGallery().getFirst().sourcePage());
    }

    private JsonNode tags(String key, String value) throws Exception {
        return objectMapper.readTree("{\"" + key + "\":\"" + value + "\"}");
    }

    private JsonNode response(String element) throws Exception {
        return objectMapper.readTree("{\"elements\":[" + element + "]}");
    }
}

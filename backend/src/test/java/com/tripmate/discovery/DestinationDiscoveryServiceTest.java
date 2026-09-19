package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripmate.place.PlaceCategory;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DestinationDiscoveryServiceTest {

    private final DestinationDiscoveryService service = new DestinationDiscoveryService(
            "https://nominatim.example.test",
            "https://photon.example.test",
            "https://overpass-1.example.test/api/interpreter,https://overpass-2.example.test/api/interpreter",
            "TripMate-Test/1.0",
            1000,
            3000,
            60,
            200
    );

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void classifiesExpandedTourCategories() throws Exception {
        assertEquals(DiscoveryCategory.VIEWPOINT, service.classify(tags("""
                {"tourism":"viewpoint","name":"Doddabetta View Point"}
                """), "Doddabetta View Point"));
        assertEquals(DiscoveryCategory.WATERFALL, service.classify(tags("""
                {"natural":"waterfall","name":"Pykara Falls"}
                """), "Pykara Falls"));
        assertEquals(DiscoveryCategory.BEACH, service.classify(tags("""
                {"natural":"beach","name":"Marina Beach"}
                """), "Marina Beach"));
        assertEquals(DiscoveryCategory.STAY, service.classify(tags("""
                {"tourism":"hotel","name":"Sample Hotel"}
                """), "Sample Hotel"));
        assertEquals(DiscoveryCategory.ADVENTURE, service.classify(tags("""
                {"sport":"surfing","name":"Surf School"}
                """), "Surf School"));
        assertEquals(DiscoveryCategory.EVENT, service.classify(tags("""
                {"amenity":"events_venue","name":"City Exhibition Ground"}
                """), "City Exhibition Ground"));
    }

    @Test
    void mapsDiscoveryCategoriesToExistingTripPlaceCategories() {
        assertEquals(PlaceCategory.RESTAURANT, service.toSavedPlaceCategory(DiscoveryCategory.FOOD));
        assertEquals(PlaceCategory.SHOPPING, service.toSavedPlaceCategory(DiscoveryCategory.SHOPPING));
        assertEquals(PlaceCategory.ACTIVITY, service.toSavedPlaceCategory(DiscoveryCategory.ADVENTURE));
        assertEquals(PlaceCategory.HOTEL, service.toSavedPlaceCategory(DiscoveryCategory.STAY));
        assertEquals(PlaceCategory.ATTRACTION, service.toSavedPlaceCategory(DiscoveryCategory.VIEWPOINT));
    }

    @Test
    void buildsRadiusBoundedQueriesForPlacesFoodStaysAndAdventure() {
        String allQuery = service.buildOverpassQuery(13.0827, 80.2707, 25000, null);
        assertTrue(allQuery.contains("around:25000,13.0827,80.2707"));
        assertTrue(allQuery.contains("[\"tourism\"]"));
        assertTrue(allQuery.contains("restaurant|cafe|food_court|marketplace"));
        assertTrue(allQuery.contains("surfing"));

        String stayQuery = service.buildOverpassQuery(13.0827, 80.2707, 5000, DiscoveryCategory.STAY);
        assertTrue(stayQuery.contains("hotel|guest_house|hostel"));
        assertFalse(stayQuery.contains("[\"historic\"]"));
    }

    @Test
    void keepsConfiguredOverpassFallbackOrder() {
        assertEquals(
                List.of(
                        "https://overpass-1.example.test/api/interpreter",
                        "https://overpass-2.example.test/api/interpreter"
                ),
                service.configuredOverpassUrls()
        );
    }

    @Test
    void doesNotInventMissingPricesOrImages() throws Exception {
        JsonNode response = objectMapper.readTree("""
                {
                  "elements": [
                    {
                      "type": "node",
                      "id": 101,
                      "lat": 13.083,
                      "lon": 80.271,
                      "tags": {
                        "name": "Real Chennai Museum",
                        "tourism": "museum",
                        "opening_hours": "Tu-Su 09:00-17:00"
                      }
                    }
                  ]
                }
                """);

        List<DiscoveredPlace> places = service.mapOverpassPlacesForTest(
                response,
                new BigDecimal("13.0827"),
                new BigDecimal("80.2707"),
                10,
                null,
                "Chennai"
        );

        assertEquals(1, places.size());
        DiscoveredPlace place = places.getFirst();
        assertNull(place.estimatedCostPerPerson());
        assertEquals(PriceStatus.UNKNOWN, place.priceStatus());
        assertNull(place.imageUrl());
        assertFalse(place.imageExact());
        assertEquals("OpenStreetMap", place.sourceName());
        assertTrue(place.sourceUrl().endsWith("/node/101"));
    }

    @Test
    void mapsExplicitFreeAndSourceListedFeesWithoutCategoryEstimates() throws Exception {
        JsonNode response = objectMapper.readTree("""
                {
                  "elements": [
                    {
                      "type": "node",
                      "id": 201,
                      "lat": 13.083,
                      "lon": 80.271,
                      "tags": {
                        "name": "Free City Park",
                        "leisure": "park",
                        "fee": "no"
                      }
                    },
                    {
                      "type": "node",
                      "id": 202,
                      "lat": 13.084,
                      "lon": 80.272,
                      "tags": {
                        "name": "Paid Museum",
                        "tourism": "museum",
                        "fee": "yes",
                        "charge": "INR 50 per person"
                      }
                    }
                  ]
                }
                """);

        List<DiscoveredPlace> places = service.mapOverpassPlacesForTest(
                response,
                new BigDecimal("13.0827"),
                new BigDecimal("80.2707"),
                10,
                null,
                "Chennai"
        );

        DiscoveredPlace free = places.stream().filter(p -> p.name().startsWith("Free")).findFirst().orElseThrow();
        assertEquals(PriceStatus.FREE, free.priceStatus());
        assertEquals(new BigDecimal("0.00"), free.estimatedCostPerPerson());

        DiscoveredPlace paid = places.stream().filter(p -> p.name().startsWith("Paid")).findFirst().orElseThrow();
        assertEquals(PriceStatus.ESTIMATED, paid.priceStatus());
        assertEquals(new BigDecimal("50.00"), paid.estimatedCostPerPerson());
        assertEquals(PriceType.PER_PERSON, paid.priceType());
        assertEquals(1, paid.priceOptions().size());
    }

    @Test
    void preservesExactWikimediaImagesWithAttribution() throws Exception {
        JsonNode response = objectMapper.readTree("""
                {
                  "elements": [
                    {
                      "type": "node",
                      "id": 301,
                      "lat": 13.083,
                      "lon": 80.271,
                      "tags": {
                        "name": "Verified Monument",
                        "historic": "monument",
                        "wikimedia_commons": "File:Verified Monument.jpg"
                      }
                    }
                  ]
                }
                """);

        DiscoveredPlace place = service.mapOverpassPlacesForTest(
                response,
                new BigDecimal("13.0827"),
                new BigDecimal("80.2707"),
                10,
                null,
                "Chennai"
        ).getFirst();

        assertTrue(place.imageExact());
        assertEquals("Wikimedia Commons", place.imageSource());
        assertTrue(place.imageUrl().contains("Special:FilePath"));
    }

    @Test
    void classifiesMappedTravelAgentsAsTourServices() throws Exception {
        JsonNode response = objectMapper.readTree("""
                {
                  "elements": [
                    {
                      "type": "node",
                      "id": 401,
                      "lat": 13.083,
                      "lon": 80.271,
                      "tags": {
                        "name": "Local Tour Desk",
                        "office": "travel_agent"
                      }
                    }
                  ]
                }
                """);

        DiscoveredPlace place = service.mapOverpassPlacesForTest(
                response,
                new BigDecimal("13.0827"),
                new BigDecimal("80.2707"),
                10,
                null,
                "Chennai"
        ).getFirst();

        assertEquals(DiscoveryItemType.TOUR_SERVICE, place.itemType());
        assertEquals(PriceStatus.UNKNOWN, place.priceStatus());
    }

    private JsonNode tags(String json) throws Exception {
        return objectMapper.readTree(json);
    }
}

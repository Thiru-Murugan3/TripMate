package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripmate.place.PlaceCategory;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DestinationDiscoveryServiceTest {

    private final DestinationDiscoveryService service =
            new DestinationDiscoveryService(
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
    void classifiesOotyStyleTouristLocations() throws Exception {
        assertEquals(
                DiscoveryCategory.VIEWPOINT,
                service.classify(tags("""
                        {"tourism":"viewpoint","name":"Doddabetta View Point"}
                        """), "Doddabetta View Point")
        );

        assertEquals(
                DiscoveryCategory.WATERFALL,
                service.classify(tags("""
                        {"natural":"waterfall","name":"Pykara Falls"}
                        """), "Pykara Falls")
        );

        assertEquals(
                DiscoveryCategory.LAKE,
                service.classify(tags("""
                        {"natural":"water","water":"lake","name":"Ooty Lake"}
                        """), "Ooty Lake")
        );

        assertEquals(
                DiscoveryCategory.PARK,
                service.classify(tags("""
                        {"leisure":"garden","name":"Government Botanical Garden"}
                        """), "Government Botanical Garden")
        );

        assertEquals(
                DiscoveryCategory.MUSEUM,
                service.classify(tags("""
                        {"tourism":"museum","name":"Tea Museum"}
                        """), "Tea Museum")
        );
    }

    @Test
    void mapsDiscoveryCategoriesToExistingTripPlaceCategories() {
        assertEquals(PlaceCategory.RESTAURANT, service.toSavedPlaceCategory(DiscoveryCategory.FOOD));
        assertEquals(PlaceCategory.SHOPPING, service.toSavedPlaceCategory(DiscoveryCategory.SHOPPING));
        assertEquals(PlaceCategory.ACTIVITY, service.toSavedPlaceCategory(DiscoveryCategory.ADVENTURE));
        assertEquals(PlaceCategory.ATTRACTION, service.toSavedPlaceCategory(DiscoveryCategory.VIEWPOINT));
    }

    @Test
    void buildsRadiusBoundedOverpassQueries() {
        String allQuery = service.buildOverpassQuery(11.4064, 76.6932, 25000, null);
        assertTrue(allQuery.contains("around:25000,11.4064,76.6932"));
        assertTrue(allQuery.contains("[\"tourism\"]"));
        assertTrue(allQuery.contains("[\"historic\"]"));

        String foodQuery = service.buildOverpassQuery(11.4064, 76.6932, 5000, DiscoveryCategory.FOOD);
        assertTrue(foodQuery.contains("restaurant|cafe|fast_food|food_court"));
        assertFalse(foodQuery.contains("[\"historic\"]"));
    }

    @Test
    void keepsConfiguredOverpassFallbackOrder() {
        assertEquals(
                java.util.List.of(
                        "https://overpass-1.example.test/api/interpreter",
                        "https://overpass-2.example.test/api/interpreter"
                ),
                service.configuredOverpassUrls()
        );
    }

    @Test
    void suggestsLongerVisitsForMuseumsAndNatureThanSimpleAttractions() {
        assertEquals(120, service.suggestedVisitMinutes(DiscoveryCategory.MUSEUM));
        assertEquals(90, service.suggestedVisitMinutes(DiscoveryCategory.NATURE));
        assertEquals(60, service.suggestedVisitMinutes(DiscoveryCategory.ATTRACTION));
    }

    private JsonNode tags(String json) throws Exception {
        return objectMapper.readTree(json);
    }
}

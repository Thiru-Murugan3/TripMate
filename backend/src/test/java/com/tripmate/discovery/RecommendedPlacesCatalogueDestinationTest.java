package com.tripmate.discovery;

import com.tripmate.discovery.provider.GeocodedDestination;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/** Runs against the real bundled catalogue. */
class RecommendedPlacesCatalogueDestinationTest {

    private final RecommendedPlacesCatalogue catalogue = new RecommendedPlacesCatalogue();

    private static GeocodedDestination at(String lat, String lon, String display, String district, String state) {
        return new GeocodedDestination(new BigDecimal(lat), new BigDecimal(lon), display, null, district, state, "IN", "test");
    }

    // How Nominatim geocodes "Coorg": the Kodagu district boundary.
    private static final GeocodedDestination COORG = at("12.3827332", "75.6640715", "Kodagu, Karnataka, India", "Kodagu", "Karnataka");

    @Test
    @DisplayName("a Coorg search gets Coorg's (Madikeri) list, never Goa's")
    void coorgGetsMadikeriNotGoa() {
        for (String query : new String[]{"Coorg", "Coorg, Karnataka", "Kodagu"}) {
            var list = catalogue.forDestination(query, COORG).orElseThrow();
            assertEquals("Madikeri", list.title(), query);
        }
    }

    @Test
    @DisplayName("a destination without coordinates is never the nearest fallback")
    void coordinateLessDestinationIsNotNearEverything() {
        // Somewhere with no catalogue destination nearby must get no list at all.
        var middleOfNowhere = at("21.0000", "79.5000", "Nowhere, Maharashtra, India", null, "Maharashtra");
        assertTrue(catalogue.forDestination("Nowhere", middleOfNowhere).isEmpty());
    }

    @Test
    @DisplayName("searching Goa by name still finds Goa's list even though it has no coordinates")
    void goaByNameStillWorks() {
        var goa = at("15.3004", "74.0855", "Goa, India", null, "Goa");
        assertEquals("Goa", catalogue.forDestination("Goa", goa).orElseThrow().title());
    }
}

package com.tripmate.discovery;

import com.tripmate.discovery.provider.GeocodedDestination;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class RecommendedPlacesCatalogueTest {
    private final RecommendedPlacesCatalogue catalogue = new RecommendedPlacesCatalogue();

    private GeocodedDestination at(String lat, String lon, String display, String city) {
        return new GeocodedDestination(new BigDecimal(lat), new BigDecimal(lon), display, city, null, null, "IN", "Test");
    }

    @Test void loadsTheBundledListForFamousDestinations() {
        var rishikesh = catalogue.forDestination("Rishikesh", at("30.0869", "78.2676", "Rishikesh, Uttarakhand, India", "Rishikesh")).orElseThrow();
        assertEquals("Rishikesh", rishikesh.title());
        assertTrue(rishikesh.places().size() >= 20);
        assertTrue(rishikesh.places().stream().anyMatch(p -> p.name().toLowerCase().contains("rafting")));
        assertTrue(rishikesh.places().size() <= 30);
    }

    @Test void findsADestinationByWhatTheUserTypedEvenIfTheGeocoderNamesItDifferently() {
        var ooty = catalogue.forDestination("Ooty", at("11.41", "76.70", "Udhagamandalam, Nilgiris, Tamil Nadu, India", "Udhagamandalam")).orElseThrow();
        assertEquals("Ooty", ooty.title());
        assertTrue(ooty.places().stream().anyMatch(p -> p.name().startsWith("Pykara")));
    }

    @Test void ignoresSameNamedPlacesFarAwayAndForeignDestinations() {
        // A same-named search resolved near Delhi gets Delhi's list (nearest destination), never Ooty's.
        var nearDelhi = catalogue.forDestination("Ooty", at("28.61", "77.21", "Somewhere, Delhi, India", "Somewhere"));
        assertTrue(nearDelhi.map(d -> !d.title().equals("Ooty")).orElse(true));
        var abroad = new GeocodedDestination(new BigDecimal("51.5"), new BigDecimal("-0.12"), "London, United Kingdom", "London", null, null, "GB", "Test");
        assertTrue(catalogue.forDestination("London", abroad).isEmpty());
    }

    @Test void matchesNameVariantsButNotGenericOnes() {
        assertTrue(RecommendedPlacesCatalogue.sameName("Ooty Botanical Gardens", "Government Botanical Garden", "Ooty"));
        assertTrue(RecommendedPlacesCatalogue.sameName("Lakshman Jhula", "Laxman Jhula", "Rishikesh"));
        assertTrue(RecommendedPlacesCatalogue.sameName("Bungee jump", "Bungee jumping at Mohan Chatti", "Rishikesh"));
        assertTrue(RecommendedPlacesCatalogue.sameName("Vashishta Cave", "Vashishta Gufa", "Rishikesh"));
        assertFalse(RecommendedPlacesCatalogue.sameName("Ooty Lake", "Avalanche Lake", "Ooty"));
        assertFalse(RecommendedPlacesCatalogue.sameName("Pykara Falls", "Pykara Lake and boat house", "Ooty"));
    }

    @Test void guessesACategoryFromTheName() {
        assertEquals(DiscoveryCategory.LAKE, DestinationDiscoveryService.guessCategory("Pykara Lake and boat house"));
        assertEquals(DiscoveryCategory.WATERFALL, DestinationDiscoveryService.guessCategory("Pykara Falls"));
        assertEquals(DiscoveryCategory.TEMPLE, DestinationDiscoveryService.guessCategory("Ganga Aarti at Triveni Ghat"));
        assertEquals(DiscoveryCategory.ATTRACTION, DestinationDiscoveryService.guessCategory("Wax World"));
    }
}

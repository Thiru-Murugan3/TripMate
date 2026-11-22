package com.tripmate.discovery;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import static com.tripmate.discovery.TripTypeAffinity.Style.*;
import static org.junit.jupiter.api.Assertions.*;

class TripTypeAffinityTest {
    private DiscoveredPlace place(String name, DiscoveryCategory category) {
        return DiscoveredPlace.builder().externalId("test:" + name).name(name).category(category)
                .latitude(new BigDecimal("11.4")).longitude(new BigDecimal("76.7")).distanceKm(1).build();
    }

    private List<String> ranked(TripTypeAffinity.Style style, DiscoveredPlace... places) {
        return java.util.Arrays.stream(places)
                .filter(p -> !TripTypeAffinity.hidden(p, style))
                .sorted(Comparator.comparingInt((DiscoveredPlace p) -> TripTypeAffinity.score(p, style)).reversed())
                .map(DiscoveredPlace::name).toList();
    }

    private final DiscoveredPlace zoo = place("Ooty Deer Park", DiscoveryCategory.PARK);
    private final DiscoveredPlace trek = place("Mukurthi Peak Trek", DiscoveryCategory.NATURE);
    private final DiscoveredPlace lake = place("Ooty Lake Boat House", DiscoveryCategory.LAKE);
    private final DiscoveredPlace museum = place("Tribal Museum", DiscoveryCategory.MUSEUM);
    private final DiscoveredPlace pub = place("Hill Top Pub", DiscoveryCategory.NIGHTLIFE);
    private final DiscoveredPlace paragliding = place("Kalhatty Paragliding", DiscoveryCategory.ADVENTURE);

    @Test void familyTripsFavourFamilyPlacesAndHideNightlife() {
        List<String> order = ranked(FAMILY, trek, pub, zoo, paragliding, lake);
        assertFalse(order.contains("Hill Top Pub"));
        assertTrue(order.indexOf("Ooty Deer Park") < order.indexOf("Mukurthi Peak Trek"));
        assertTrue(order.indexOf("Ooty Lake Boat House") < order.indexOf("Kalhatty Paragliding"));
    }

    @Test void friendsTripsFavourAdventureAndKeepNightlife() {
        List<String> order = ranked(FRIENDS, museum, zoo, paragliding, trek, pub);
        assertEquals("Kalhatty Paragliding", order.get(0));
        assertTrue(order.contains("Hill Top Pub"));
        assertTrue(order.indexOf("Mukurthi Peak Trek") < order.indexOf("Tribal Museum"));
    }

    @Test void coupleTripsFavourScenicPlaces() {
        assertEquals("Ooty Lake Boat House", ranked(COUPLE, museum, paragliding, lake, zoo).get(0));
    }

    @Test void soloTripsFavourCultureAndAdventureTripsFavourTheOutdoors() {
        assertEquals("Tribal Museum", ranked(SOLO, zoo, lake, museum).get(0));
        List<String> adventure = ranked(ADVENTURE, museum, lake, trek, paragliding);
        assertEquals("Tribal Museum", adventure.get(adventure.size() - 1));
        assertTrue(adventure.indexOf("Kalhatty Paragliding") < adventure.indexOf("Ooty Lake Boat House"));
    }

    @Test void noTripTypeChangesNothing() {
        assertNull(TripTypeAffinity.parse(null));
        assertNull(TripTypeAffinity.parse("ALL"));
        assertEquals(0, TripTypeAffinity.score(pub, null));
        assertFalse(TripTypeAffinity.hidden(pub, null));
        assertEquals(FAMILY, TripTypeAffinity.parse("family"));
        assertThrows(IllegalArgumentException.class, () -> TripTypeAffinity.parse("business"));
    }
}

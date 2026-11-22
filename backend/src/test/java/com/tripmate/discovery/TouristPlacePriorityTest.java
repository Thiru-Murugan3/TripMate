package com.tripmate.discovery;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class TouristPlacePriorityTest {
    private DiscoveredPlace place(String name, DiscoveryCategory category) {
        return DiscoveredPlace.builder().externalId("test:" + name).name(name).category(category)
                .latitude(new BigDecimal("9.92")).longitude(new BigDecimal("78.12")).distanceKm(1).build();
    }

    @Test void realAttractionsComeFirst() {
        assertEquals(0, TouristPlacePriority.rank(place("Meenakshi Temple", DiscoveryCategory.TEMPLE)));
        assertEquals(0, TouristPlacePriority.rank(place("Government Botanical Garden", DiscoveryCategory.PARK)));
    }

    @Test void statuesAreKeptButRankBelowAttractions() {
        assertEquals(1, TouristPlacePriority.rank(place("Kattabomman Statue", DiscoveryCategory.ATTRACTION)));
        assertEquals(1, TouristPlacePriority.rank(place("Kakkan Silai", DiscoveryCategory.ATTRACTION)));
    }

    @Test void roadsGroundsAndServicesSinkFurther() {
        assertEquals(3, TouristPlacePriority.rank(place("Kalaignar Karunanidhi Selai", DiscoveryCategory.ATTRACTION)));
        assertEquals(3, TouristPlacePriority.rank(place("Medical College Ground", DiscoveryCategory.ATTRACTION)));
        assertEquals(3, TouristPlacePriority.rank(place("Co operator guest house", DiscoveryCategory.STAY)));
    }

    @Test void roadSignMarkersRankLast() {
        assertEquals(4, TouristPlacePriority.rank(place("2 | 36", DiscoveryCategory.ATTRACTION)));
        assertEquals(4, TouristPlacePriority.rank(place("17 | 36 Hair pin bend", DiscoveryCategory.VIEWPOINT)));
    }

    @Test void genericLabelsAndMinorStreamsSink() {
        assertEquals(3, TouristPlacePriority.rank(place("Aarti", DiscoveryCategory.ATTRACTION)));
        assertEquals(3, TouristPlacePriority.rank(place("Shiva", DiscoveryCategory.ATTRACTION)));
        assertEquals(3, TouristPlacePriority.rank(place("Bār Sot", DiscoveryCategory.RIVER)));
        assertEquals(3, TouristPlacePriority.rank(place("Suswā Nadi", DiscoveryCategory.RIVER)));
        assertEquals(0, TouristPlacePriority.rank(place("Ganga Aarti at Triveni Ghat", DiscoveryCategory.ATTRACTION)));
        assertEquals(2, TouristPlacePriority.rank(place("Ganges", DiscoveryCategory.RIVER)));
    }

    @Test void wordMatchingDoesNotCatchPartialWords() {
        // "Broadway" contains "road" but is not a road record.
        assertEquals(0, TouristPlacePriority.rank(place("Broadway Museum", DiscoveryCategory.MUSEUM)));
    }
}

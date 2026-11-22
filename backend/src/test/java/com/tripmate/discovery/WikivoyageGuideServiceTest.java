package com.tripmate.discovery;

import com.tripmate.discovery.provider.DiscoveryProviderRequest;
import com.tripmate.discovery.provider.GeocodedDestination;
import com.tripmate.discovery.provider.WikivoyageDiscoveryProvider;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WikivoyageGuideServiceTest {
    private static final GeocodedDestination RISHIKESH = new GeocodedDestination(new BigDecimal("30.0869"), new BigDecimal("78.2676"),
            "Rishikesh, Uttarakhand, India", "Rishikesh", "Dehradun", "Uttarakhand", "IN", "Test");

    private static final String WIKITEXT = """
            {{pagebanner}}
            {{geo|30.1|78.29}}
            ==Understand==
            Rishikesh is famous. '''Not a sight''' in this section.
            ==See==
            * {{see | name=Parmarth Niketan Ashram | lat=30.119113 | long=78.312209 | content=Large ashram with evening [[Ganga]] aarti. }}
            * {{see | name=Patna Waterfalls | content=Short hike. }}
            * '''[[Lakshman Jhula]]''' – iconic suspension bridge.
            ==Do==
            * {{do | name=Indian Palmistry Institute | lat=30.12 | long=78.31 | content=Readings. }}
            ===Outdoor activities===
            * '''[[Whitewater sports|White water rafting]]''' – Rishikesh is very popular for its rafting on the River Ganga.
            * '''Bungee jumping''' – At Mohan Chatti.
            ==Eat==
            * '''Some Cafe''' – food.
            """;

    @Test void parsesGuideSightsHighlightsAndActivities() {
        var guide = WikivoyageGuideService.parse(WIKITEXT, "Rishikesh", RISHIKESH);
        assertEquals("https://en.wikivoyage.org/wiki/Rishikesh", guide.pageUrl());
        assertEquals(List.of("Parmarth Niketan Ashram", "Patna Waterfalls"), guide.listings().stream().map(WikivoyageGuideService.Listing::name).toList());
        assertTrue(guide.highlights().containsAll(Set.of("Lakshman Jhula", "White water rafting", "Bungee jumping")));
        assertFalse(guide.highlights().contains("Indian Palmistry Institute"), "business 'Do' listings are not recommendations");
        assertFalse(guide.highlights().contains("Some Cafe"), "only See/Do sections count");
        assertFalse(guide.highlights().contains("Not a sight"));
        assertEquals(List.of("White water rafting", "Bungee jumping"), guide.activities().stream().map(WikivoyageGuideService.Activity::name).toList());
        assertTrue(guide.activities().get(0).description().contains("rafting on the River Ganga"));
    }

    @Test void ignoresGuidesForAPlaceFarAway() {
        String elsewhere = WIKITEXT.replace("{{geo|30.1|78.29}}", "{{geo|11.4|76.7}}");
        assertSame(WikivoyageGuideService.Guide.EMPTY, WikivoyageGuideService.parse(elsewhere, "Rishikesh", RISHIKESH));
        assertSame(WikivoyageGuideService.Guide.EMPTY, WikivoyageGuideService.parse("no geo here", "Rishikesh", RISHIKESH));
    }

    @Test void matchesSpellingVariantsButNotUnrelatedNames() {
        var highlights = WikivoyageGuideService.parse(WIKITEXT, "Rishikesh", RISHIKESH).normalizedHighlights();
        assertTrue(WikivoyageGuideService.recommended("Laxman Jhula", highlights));
        assertTrue(WikivoyageGuideService.recommended("Lakshman Jhula", highlights));
        assertTrue(WikivoyageGuideService.recommended("Parmarth Niketan", highlights) || WikivoyageGuideService.recommended("Parmarth Niketan Ashram", highlights));
        assertFalse(WikivoyageGuideService.recommended("Ram Jhula", highlights));
        assertFalse(WikivoyageGuideService.recommended("Aarti", highlights));
    }

    @Test void providerAddsSightsWithCoordinatesAndAreaActivities() {
        var guides = mock(WikivoyageGuideService.class);
        when(guides.guide(RISHIKESH)).thenReturn(WikivoyageGuideService.parse(WIKITEXT, "Rishikesh", RISHIKESH));
        var result = new WikivoyageDiscoveryProvider(guides).discover(new DiscoveryProviderRequest("Rishikesh", RISHIKESH, 25, null));
        var names = result.places().stream().map(DiscoveredPlace::name).toList();
        assertTrue(names.contains("Parmarth Niketan Ashram"));
        assertFalse(names.contains("Patna Waterfalls"), "no coordinates in the guide → not placed on the map");
        assertTrue(names.contains("White water rafting in Rishikesh"));
        var rafting = result.places().stream().filter(p -> p.name().startsWith("White water")).findFirst().orElseThrow();
        assertEquals(DiscoveryItemType.ACTIVITY, rafting.itemType());
        assertTrue(rafting.description().contains("Area activity"));
        assertEquals(WikivoyageDiscoveryProvider.RECOMMENDED_POPULARITY, rafting.popularityScore());
        assertTrue(result.attribution().contains("CC BY-SA"));
        var ashram = result.places().stream().filter(p -> p.name().startsWith("Parmarth")).findFirst().orElseThrow();
        assertEquals(DiscoveryCategory.TEMPLE, ashram.category());
    }

    @Test void providerSkipsNamedPlaceSearches() {
        var guides = mock(WikivoyageGuideService.class);
        var result = new WikivoyageDiscoveryProvider(guides).discover(new DiscoveryProviderRequest("Rishikesh", RISHIKESH, 25, null, "Ram Jhula"));
        assertTrue(result.places().isEmpty());
        verifyNoInteractions(guides);
    }
}

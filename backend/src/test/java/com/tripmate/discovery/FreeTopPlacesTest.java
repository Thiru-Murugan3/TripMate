package com.tripmate.discovery;

import com.tripmate.discovery.curated.*;
import com.tripmate.discovery.provider.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FreeTopPlacesTest {
    private DestinationGeocodingService geo;
    private CuratedDiscoveryProvider curated;
    private OverpassDiscoveryProvider osm;
    private WikidataDiscoveryProvider wiki;
    private GeoapifyDiscoveryProvider paid;
    private OpenTripMapDiscoveryProvider restricted;
    private DestinationDiscoveryService service;
    @BeforeEach void setup() {
        geo=mock(DestinationGeocodingService.class);curated=mock(CuratedDiscoveryProvider.class);osm=mock(OverpassDiscoveryProvider.class);
        wiki=mock(WikidataDiscoveryProvider.class);paid=mock(GeoapifyDiscoveryProvider.class);restricted=mock(OpenTripMapDiscoveryProvider.class);
        when(geo.geocode(anyString())).thenReturn(new GeocodedDestination(new BigDecimal("11.41"),new BigDecimal("76.69"),"Ooty, Tamil Nadu, India","Ooty",null,"Tamil Nadu","IN","Test"));
        for (DiscoveryProvider p:List.of(curated,osm,wiki,paid,restricted)) {
            String name=p.getClass().getSimpleName();
            when(p.name()).thenReturn(name);when(p.discover(any())).thenReturn(result(name,List.of()));
        }
        service=new DestinationDiscoveryService(geo,List.of(curated,osm,paid,restricted,wiki),mock(CuratedDiscoveryRepository.class),mock(CuratedDiscoveryMapper.class),6,60,500);
    }
    private DiscoveredPlace place(String name,DiscoveryCategory category,int prominence,boolean reviewed) {
        return DiscoveredPlace.builder().externalId("test:"+name).name(name).category(category).latitude(new BigDecimal("11.41"))
                .longitude(new BigDecimal("76.69")).distanceKm(2).sourceName("Source").sourceUrl("https://tourism.example/"+name.replace(' ','-'))
                .curated(reviewed).confidenceScore(.72).popularityScore(prominence).build();
    }
    private DiscoveryProviderResult result(String source,List<DiscoveredPlace> places) {return new DiscoveryProviderResult(source,source+" attribution",places,List.of());}
    @Test void selectsUpToTenTouristHighlightsWithoutCallingKeyedOrRestrictedProviders() {
        var records=new ArrayList<DiscoveredPlace>();
        for(int i=0;i<14;i++)records.add(place("Landmark "+i,DiscoveryCategory.MUSEUM,i,false));
        records.add(place("Hotel",DiscoveryCategory.STAY,999,false));records.add(place("Restaurant",DiscoveryCategory.FOOD,999,false));
        records.add(place("Shop",DiscoveryCategory.SHOPPING,999,false));
        when(osm.discover(any())).thenReturn(result("OpenStreetMap",records));
        when(curated.discover(any())).thenReturn(result("Catalogue",List.of(place("Reviewed landmark",DiscoveryCategory.HISTORICAL,0,true))));
        var response=service.topPlaces("Ooty",25);
        assertEquals(10,response.resultCount());assertEquals(10,response.places().size());assertEquals(1,response.totalPages());
        assertEquals("Reviewed landmark",response.places().getFirst().name());assertEquals("Landmark 13",response.places().get(1).name());
        assertFalse(response.places().stream().anyMatch(p->Set.of("Hotel","Restaurant","Shop").contains(p.name())));
        verify(paid,never()).discover(any());verify(restricted,never()).discover(any());
        verify(wiki).discover(any());assertTrue(response.attribution().contains("Catalogue"));
    }
    @Test void freeCacheNeverReusesOrdinaryProviderInventoryAndRetainsDetailsForPlanning() {
        var free=place("Free source landmark",DiscoveryCategory.PARK,1,false);var keyed=place("Keyed provider record",DiscoveryCategory.ATTRACTION,999,false);
        when(wiki.discover(any())).thenReturn(result("Wikidata",List.of(free)));when(paid.discover(any())).thenReturn(result("Geoapify",List.of(keyed)));
        assertEquals(2,service.search("Ooty",25,"ALL").resultCount());
        var top=service.topPlaces("Ooty",25);assertEquals(List.of(free),top.places());
        service.topPlaces("Ooty",25);verify(wiki,times(2)).discover(any());verify(paid,times(1)).discover(any());
        assertEquals(free,service.findByExternalId(free.externalId()));
        assertEquals(2,service.search("Ooty",25,"ALL").resultCount());
    }
    @Test void partialFailuresReturnFewerRealPlacesWithUnknownFeesAndNoGeneratedPhoto() {
        var landmark=place("Lake",DiscoveryCategory.LAKE,1,false);
        when(osm.discover(any())).thenThrow(new RuntimeException("offline"));when(wiki.discover(any())).thenReturn(result("Wikidata",List.of(landmark)));
        var response=service.topPlaces("Ooty",50);
        assertEquals(1,response.resultCount());assertEquals(50,response.radiusKm());assertTrue(response.warnings().stream().anyMatch(w->w.contains("unavailable")));
        assertEquals(PriceStatus.UNKNOWN,response.places().getFirst().priceStatus());assertNull(response.places().getFirst().primaryImageUrl());
        verify(paid,never()).discover(any());verify(restricted,never()).discover(any());
    }
    @Test void neverFillsMissingSourcesWithPlaceholdersAndValidatesSearchBounds() {
        when(wiki.discover(any())).thenReturn(result("Wikidata",List.of(place("Unlinked",DiscoveryCategory.NATURE,10,false).toBuilder().sourceUrl(null).build())));
        assertEquals(0,service.topPlaces("Ooty",25).resultCount());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.topPlaces("x",25));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.topPlaces("Ooty",101));
    }
    @Test void userSuppliedNameFiltersCannotCollideWithTheFreeCacheNamespace() {
        var keyed=place("Free Highlights",DiscoveryCategory.ATTRACTION,99,false);
        var free=place("Lake",DiscoveryCategory.LAKE,1,false);
        when(paid.discover(any())).thenReturn(result("Geoapify",List.of(keyed)));
        when(wiki.discover(any())).thenReturn(result("Wikidata",List.of(free)));
        var filter=new DiscoverySearchFilters("ALL",null,null,null,null,null,null,null,null,null,null,null,"RELEVANCE",0,10,"|free-highlights");
        assertEquals(List.of(keyed),service.search("Ooty",25,filter).places());
        assertEquals(List.of(free),service.topPlaces("Ooty",25).places());
    }

}

package com.tripmate.discovery.provider;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GeoapifyPaginationTest {
    @Test void generalSearchExcludesIncidentalSportsButKeepsTouristDesignationsAndExactSearch(){
        String response="""
          {"features":[
          {"properties":{"name":"School Ground","place_id":"1","categories":["leisure","sport.pitch"],"datasource":{"raw":{"leisure":"pitch"}}},"geometry":{"coordinates":[80,13]}},
          {"properties":{"name":"Heritage Ground","place_id":"2","categories":["tourism.attraction","sport.pitch"],"datasource":{"raw":{"leisure":"pitch"}}},"geometry":{"coordinates":[80,13]}}
          ]}
          """;
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(queryParam("categories","tourism,entertainment,leisure")).andRespond(withSuccess(response,MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess(response,MediaType.APPLICATION_JSON));
        var provider=new GeoapifyDiscoveryProvider(factory,"test-secret","https://geo.example");
        assertEquals(java.util.List.of("Heritage Ground"),provider.discover(request()).places().stream().map(p->p.name()).toList());
        var named=new DiscoveryProviderRequest("Chennai",request().destination(),25,null,"School Ground");
        assertEquals(2,provider.discover(named).places().size());server.verify();
    }
    private DiscoveryProviderRequest request() {
        return new DiscoveryProviderRequest("Chennai",new GeocodedDestination(new BigDecimal("13"),new BigDecimal("80"),"Chennai, India","Chennai",null,null,"IN","Test"),25,null);
    }
    private String page(int count,int start) {
        String features=java.util.stream.IntStream.range(start,start+count).mapToObj(i -> "{\"properties\":{\"name\":\"Place "+i+"\",\"place_id\":\""+i+"\",\"categories\":[\"tourism.attraction\"]},\"geometry\":{\"coordinates\":[80,13]}}").collect(java.util.stream.Collectors.joining(","));
        return "{\"features\":["+features+"]}";
    }
    @Test void preservesNestedSourceHoursAndUnambiguousDuration() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(anything()).andRespond(withSuccess("""
            {"features":[{"properties":{"name":"Museum","place_id":"museum","categories":["entertainment.museum"],"datasource":{"raw":{"opening_hours":"Mo-Fr 09:00-17:00","duration":"00:45","osm_type":"w","osm_id":12345}}},"geometry":{"coordinates":[80,13]}}]}
            """,MediaType.APPLICATION_JSON));
        var place=new GeoapifyDiscoveryProvider(factory,"test-secret","https://geo.example").discover(request()).places().getFirst();
        assertEquals("https://www.openstreetmap.org/way/12345",place.sourceUrl());assertEquals("Mo-Fr 09:00-17:00",place.openingHours());assertEquals(45,place.suggestedVisitMinutes());
        assertEquals(45,SourceDuration.minutes("00:45"));assertEquals(91,SourceDuration.minutes("01:30:01"));
        assertNull(SourceDuration.minutes("90"));assertNull(SourceDuration.minutes("unknown"));assertNull(SourceDuration.minutes("01:99"));server.verify();
    }
    @Test void mapsAdventureInterestFromProviderEvidence() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(queryParam("categories","sport,entertainment,leisure,tourism")).andRespond(withSuccess("""
            {"features":[{"properties":{"name":"Dive Centre","place_id":"climb","categories":["sport.dive_centre"]},"geometry":{"coordinates":[80,13]}}]}
            """,MediaType.APPLICATION_JSON));
        var base=request();var provider=new GeoapifyDiscoveryProvider(factory,"test-secret","https://geo.example");
        var results=provider.discover(new DiscoveryProviderRequest(base.query(),base.destination(),25,com.tripmate.discovery.DiscoveryCategory.ADVENTURE)).places();
        assertEquals(1,results.size());assertEquals(com.tripmate.discovery.DiscoveryItemType.ACTIVITY,results.getFirst().itemType());server.verify();
    }
    @Test void fetchesLaterPagesAndStopsWhenTheProviderReturnsAShortPage() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(queryParam("offset","0")).andExpect(queryParam("limit","100")).andRespond(withSuccess(page(100,0),MediaType.APPLICATION_JSON));
        server.expect(queryParam("offset","100")).andRespond(withSuccess(page(1,100),MediaType.APPLICATION_JSON));
        var result=new GeoapifyDiscoveryProvider(factory,"test-secret","https://geo.example").discover(request());
        assertEquals(101,result.places().size());assertEquals("geoapify:100",result.places().get(100).externalId());server.verify();
    }
    @Test void failedLaterPageRetainsEarlierRecordsWithAnAvailabilityWarning() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(queryParam("offset","0")).andRespond(withSuccess(page(100,0),MediaType.APPLICATION_JSON));
        server.expect(queryParam("offset","100")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).body("test-secret raw provider body"));
        var result=new GeoapifyDiscoveryProvider(factory,"test-secret","https://geo.example").discover(request());
        assertEquals(100,result.places().size());assertTrue(result.warnings().get(0).contains("unavailable"));assertFalse(result.warnings().toString().contains("test-secret"));server.verify();
    }
}

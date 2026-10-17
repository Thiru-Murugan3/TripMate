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
    private DiscoveryProviderRequest request() {
        return new DiscoveryProviderRequest("Chennai",new GeocodedDestination(new BigDecimal("13"),new BigDecimal("80"),"Chennai, India","Chennai",null,null,"IN","Test"),25,null);
    }
    private String page(int count,int start) {
        String features=java.util.stream.IntStream.range(start,start+count).mapToObj(i -> "{\"properties\":{\"name\":\"Place "+i+"\",\"place_id\":\""+i+"\",\"categories\":[\"tourism.attraction\"]},\"geometry\":{\"coordinates\":[80,13]}}").collect(java.util.stream.Collectors.joining(","));
        return "{\"features\":["+features+"]}";
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

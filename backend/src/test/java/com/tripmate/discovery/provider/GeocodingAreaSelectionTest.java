package com.tripmate.discovery.provider;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GeocodingAreaSelectionTest {
    @Test void nominatimSkipsAnUnrelatedBusinessAndSelectsTheAreaCandidate() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(queryParam("limit","8")).andRespond(withSuccess("""
          [{"category":"shop","lat":"10","lon":"75","display_name":"Ooty Store, India","address":{"country_code":"in"}},
           {"category":"boundary","lat":"11.41","lon":"76.69","display_name":"Ooty, Tamil Nadu, India","address":{"country_code":"in","town":"Ooty"}}]
          """,MediaType.APPLICATION_JSON));
        assertEquals("Ooty",new NominatimGeocodingProvider(factory,"https://geo.example").geocode("Ooty").orElseThrow().city());server.verify();
    }
    @Test void photonAlsoSkipsBusinessCandidatesForDestinationSearch() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(anything()).andRespond(withSuccess("""
          {"features":[
           {"properties":{"name":"Jaipur Shop","osm_key":"shop","countrycode":"IN"},"geometry":{"coordinates":[80,13]}},
           {"properties":{"name":"Jaipur","osm_key":"place","countrycode":"IN","state":"Rajasthan"},"geometry":{"coordinates":[75.8,26.9]}}]}
          """,MediaType.APPLICATION_JSON));
        assertEquals("Jaipur",new PhotonGeocodingProvider(factory,"https://geo.example").geocode("Jaipur").orElseThrow().city());server.verify();
    }
    @Test void publicNominatimIsNotUsedForAutocomplete() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        assertTrue(new NominatimGeocodingProvider(factory,"https://nominatim.openstreetmap.org").suggest("Ooty",5).isEmpty());server.verify();
    }
    @Test void publicNominatimLimitsAggregateRequestsWithoutBlockingFallbacks() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(anything()).andRespond(withSuccess("[]",MediaType.APPLICATION_JSON));
        var provider=new NominatimGeocodingProvider(factory,"https://nominatim.openstreetmap.org");
        provider.geocode("Ooty");
        assertThrows(org.springframework.web.client.RestClientException.class,()->provider.geocode("Chennai"));server.verify();
    }

}

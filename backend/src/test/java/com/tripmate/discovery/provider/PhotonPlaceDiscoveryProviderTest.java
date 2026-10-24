package com.tripmate.discovery.provider;

import com.tripmate.discovery.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class PhotonPlaceDiscoveryProviderTest {
    private DiscoveryProviderRequest request(String city, String name) {
        return new DiscoveryProviderRequest(city,new GeocodedDestination(new BigDecimal("10.238"),new BigDecimal("77.49"),city+", India",city,null,"Tamil Nadu","IN","Test"),25,null,name);
    }
    private OverpassDiscoveryProvider mapper(ProviderHttpClientFactory factory) {
        return new OverpassDiscoveryProvider(factory,new PriceVerificationService(30),new ImageResolverService(mock(CommonsImageService.class)),mock(WikimediaEnrichmentService.class),"",500);
    }
    @Test void findsNamedOsmObjectsWithoutWikidataAndRejectsForeignDistantOrInvalidObjects() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(queryParam("q","Coakers%20Walk")).andExpect(queryParam("countrycode","IN"))
                .andExpect(queryParam("limit","20")).andExpect(queryParam("bbox",org.hamcrest.Matchers.containsString("77.")))
                .andRespond(withSuccess("""
                  {"features":[
                    {"properties":{"name":"Coaker's Walk","countrycode":"IN","osm_type":"W","osm_id":101,"osm_key":"tourism","osm_value":"viewpoint","extra":{"image":"https://images.example/uncredited.jpg"}},"geometry":{"coordinates":[77.491,10.239]}},
                    {"properties":{"name":"Coakers Walk elsewhere","countrycode":"IN","osm_type":"N","osm_id":102},"geometry":{"coordinates":[80,13]}},
                    {"properties":{"name":"Foreign","countrycode":"US","osm_type":"N","osm_id":103},"geometry":{"coordinates":[77.491,10.239]}},
                    {"properties":{"name":"Coakers Walk Road","countrycode":"IN","osm_type":"W","osm_id":104,"osm_key":"highway","osm_value":"tertiary"},"geometry":{"coordinates":[77.491,10.239]}},
                    {"properties":{"name":"Bad ID","countrycode":"IN","osm_type":"N","osm_id":"../bad"},"geometry":{"coordinates":[77.491,10.239]}}
                  ]}
                  """,MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.openstreetmap.org/api/0.6/way/101.json")).andRespond(withStatus(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE));
        var result=new PhotonPlaceDiscoveryProvider(factory,mapper(factory),"https://photon.example").discover(request("Kodaikanal","Coakers Walk"));
        assertEquals(1,result.places().size());var place=result.places().getFirst();
        assertEquals("osm:way:101",place.externalId());assertEquals(DiscoveryCategory.VIEWPOINT,place.category());
        assertEquals("https://www.openstreetmap.org/way/101",place.sourceUrl());
        assertEquals(PriceStatus.UNKNOWN,place.priceStatus());assertNull(place.estimatedCostPerPerson());assertNull(place.primaryImageUrl());
        assertTrue(result.attribution().contains("OpenStreetMap"));server.verify();
    }
    @Test void adventureFallbackKeepsRealNearbyResultsWhenAnotherLookupFails() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(queryParam("q","rafting")).andExpect(queryParam("bbox",org.hamcrest.Matchers.containsString("78.")))
          .andRespond(withSuccess("""
            {"features":[{"properties":{"name":"Heval River Cottage and Rafting Camp","countrycode":"IN","osm_type":"N","osm_id":13454788338,"osm_key":"tourism","osm_value":"camp_site"},"geometry":{"coordinates":[78.3802223,30.1088417]}}]}
            """,MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.openstreetmap.org/api/0.6/node/13454788338.json")).andRespond(withSuccess("""
            {"elements":[{"type":"node","id":13454788338,"lat":30.1088417,"lon":78.3802223,"tags":{"name":"Heval River Cottage and Rafting Camp","tourism":"camp_site","opening_hours":"24/7","website":"https://hevalrivercottage.in/"}}]}
            """,MediaType.APPLICATION_JSON));
        server.expect(queryParam("q","bungee")).andRespond(withStatus(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE));
        server.expect(queryParam("q","adventure")).andRespond(withSuccess("{\"features\":[]}",MediaType.APPLICATION_JSON));
        var request=new DiscoveryProviderRequest("Rishikesh",new GeocodedDestination(new BigDecimal("30.108"),new BigDecimal("78.29"),"Rishikesh, India","Rishikesh",null,"Uttarakhand","IN","Test"),25,DiscoveryCategory.ADVENTURE);
        var result=new PhotonPlaceDiscoveryProvider(factory,mapper(factory),"https://photon.example").discover(request);
        assertEquals(1,result.places().size());var place=result.places().getFirst();
        assertEquals("osm:node:13454788338",place.externalId());assertEquals(DiscoveryCategory.ADVENTURE,place.category());
        assertEquals("24/7",place.openingHours());assertNotNull(place.officialWebsite());assertNull(place.openNow());assertEquals(PriceStatus.UNKNOWN,place.priceStatus());assertNull(place.primaryImageUrl());assertTrue(result.warnings().stream().anyMatch(w->w.contains("unavailable")));server.verify();
    }
    @Test void cityBrowsingDoesNotCallTheNamedLookup() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        assertTrue(new PhotonPlaceDiscoveryProvider(factory,mapper(factory),"https://photon.example").discover(request("Ooty",null)).places().isEmpty());server.verify();
    }
    @Test void providerFailurePropagatesForTheOrchestratorToReturnPartialResults() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(anything()).andRespond(withSuccess("{}",MediaType.APPLICATION_JSON));
        assertThrows(IllegalStateException.class,()->new PhotonPlaceDiscoveryProvider(factory,mapper(factory),"https://photon.example").discover(request("Ooty","Doddabetta")));server.verify();
    }
}

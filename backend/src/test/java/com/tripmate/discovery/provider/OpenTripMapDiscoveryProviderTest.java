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

class OpenTripMapDiscoveryProviderTest {
    private DiscoveryProviderRequest request() {
        return new DiscoveryProviderRequest("Chennai",new GeocodedDestination(new BigDecimal("13.0827"),new BigDecimal("80.2707"),
                "Chennai, Tamil Nadu, India","Chennai","Chennai","Tamil Nadu","IN","Test"),25,null);
    }
    @Test void disabledOrMissingKeyMakesNoRequests() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        for(var p:new OpenTripMapDiscoveryProvider[]{new OpenTripMapDiscoveryProvider(builder.build(),mock(WikimediaEnrichmentService.class),false,"secret"),
                new OpenTripMapDiscoveryProvider(builder.build(),mock(WikimediaEnrichmentService.class),true,"")}) {
            assertTrue(p.discover(request()).places().isEmpty());assertFalse(p.discover(request()).warnings().isEmpty());
        }
        server.verify();
    }
    @Test void mapsDocumentedRadiusResultsWithExactCreditsAndUnknownFees() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var enrichment=mock(WikimediaEnrichmentService.class);
        var image=new DiscoveryImage("https://upload.wikimedia.org/garden.jpg","https://commons.wikimedia.org/wiki/File:Garden.jpg","Wikimedia Commons","Author","CC BY-SA 4.0","Author",true,true);
        when(enrichment.resolve(any())).thenReturn(new WikimediaEnrichmentService.Enrichment("A garden",image,"https://www.wikidata.org/wiki/Q123","Q123"));
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://api.opentripmap.com/0.1/en/places/radius?")))
                .andExpect(queryParam("format","json")).andExpect(queryParam("limit","100")).andExpect(queryParam("radius","25000"))
                .andExpect(queryParam("apikey","server-secret")).andRespond(withSuccess("""
                  [{"xid":"Q123","name":"Garden","kinds":"gardens_and_parks,interesting_places","wikidata":"Q123","rate":3,"point":{"lat":13.083,"lon":80.271}},
                   {"xid":"bad","name":"Outside radius","point":{"lat":11,"lon":76}},
                   {"xid":"../path","name":"Unsafe id","point":{"lat":13.083,"lon":80.271}},
                   {"xid":"missing","name":"Missing coordinates"}]
                  """,MediaType.APPLICATION_JSON));
        var result=new OpenTripMapDiscoveryProvider(builder.build(),enrichment,true,"server-secret").discover(request());
        assertEquals(1,result.places().size());var p=result.places().get(0);
        assertEquals("opentripmap:Q123",p.externalId());assertEquals(DiscoveryCategory.PARK,p.category());
        assertEquals(PriceStatus.UNKNOWN,p.priceStatus());assertNull(p.estimatedCostPerPerson());assertNull(p.rating());
        assertEquals("https://www.wikidata.org/wiki/Q123",p.sourceUrl());assertEquals(image,p.imageGallery().get(0));assertTrue(p.imageExact());assertTrue(p.sourceName().contains("ODbL"));server.verify();
    }
    @Test void campsiteAndZooSubtypesDoNotBecomeMuseumsOrFamilyCamping() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withSuccess("""
            [{"xid":"N1","name":"Elephant campsite","kinds":"museums,other_museums","point":{"lat":13.083,"lon":80.271}},
             {"xid":"N2","name":"Zoo","kinds":"zoos,museums","point":{"lat":13.083,"lon":80.271}},
             {"xid":"N3","name":"History Museum","kinds":"museums","point":{"lat":13.083,"lon":80.271}}]
            """,MediaType.APPLICATION_JSON));
        var r=request();var family=new DiscoveryProviderRequest(r.query(),r.destination(),25,DiscoveryCategory.FAMILY);
        var result=new OpenTripMapDiscoveryProvider(builder.build(),mock(WikimediaEnrichmentService.class),true,"secret").discover(family);
        assertEquals(2,result.places().size());assertFalse(result.places().stream().anyMatch(p->p.name().contains("campsite")));
        assertEquals(DiscoveryCategory.FAMILY,result.places().getFirst().category());server.verify();
    }
    @Test void optionalEnrichmentFailureKeepsThePlaceWithoutInventingAnImage() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var enrichment=mock(WikimediaEnrichmentService.class);
        when(enrichment.resolve(any())).thenThrow(new IllegalStateException("offline"));
        server.expect(anything()).andRespond(withSuccess("[{\"xid\":\"Q123\",\"name\":\"Museum\",\"kinds\":\"museums\",\"wikidata\":\"Q123\",\"point\":{\"lat\":13.083,\"lon\":80.271}}]",MediaType.APPLICATION_JSON));
        var p=new OpenTripMapDiscoveryProvider(builder.build(),enrichment,true,"secret").discover(request()).places().get(0);
        assertNull(p.primaryImageUrl());assertTrue(p.imageGallery().isEmpty());assertNull(p.description());server.verify();
    }
}

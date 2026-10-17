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

class WikidataDiscoveryProviderTest {
    private DiscoveryProviderRequest request(DiscoveryCategory category) {
        return new DiscoveryProviderRequest("Chennai",new GeocodedDestination(new BigDecimal("13.0827"),new BigDecimal("80.2707"),
                "Chennai, India","Chennai","Chennai","Tamil Nadu","IN","Test"),25,category);
    }
    private String row(String id,String label,String point) {
        return "{\"item\":{\"value\":\"http://www.wikidata.org/entity/"+id+"\"},\"itemLabel\":{\"value\":\""+label+"\"},\"kind\":{\"value\":\"http://www.wikidata.org/entity/Q33506\"},\"location\":{\"value\":\""+point+"\"}}";
    }
    @Test void mapsNearbyTypedLandmarksWithNoInventedFeesAndRejectsBadRows() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var images=mock(WikimediaEnrichmentService.class);
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://query.wikidata.org/sparql?")))
                .andExpect(queryParam("format","json")).andExpect(header("Accept","application/sparql-results+json"))
                .andRespond(withSuccess("{\"results\":{\"bindings\":["+String.join(",",row("Q123","Museum","Point(80.271 13.083)"),row("Q123","Duplicate","Point(80.271 13.083)"),
                        row("Q2","Outside","Point(76 11)"),row("Q3","Invalid","invalid"),row("Q4","Q4","Point(80.271 13.083)"))+ "]}}",MediaType.APPLICATION_JSON));
        var result=new WikidataDiscoveryProvider(builder.build(),images).discover(request(null));
        assertEquals(1,result.places().size());var place=result.places().get(0);
        assertEquals("wikidata:Q123",place.externalId());assertEquals(DiscoveryCategory.MUSEUM,place.category());
        assertEquals(PriceStatus.UNKNOWN,place.priceStatus());assertNull(place.estimatedCostPerPerson());assertNull(place.primaryImageUrl());
        assertTrue(place.sourceUrl().endsWith("/Q123"));assertTrue(place.distanceKm()<1);server.verify();
    }
    @Test void ignoresUnsupportedCategoriesWithoutCallingThePublicService() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        var provider=new WikidataDiscoveryProvider(builder.build(),mock(WikimediaEnrichmentService.class));
        assertTrue(provider.discover(request(DiscoveryCategory.FOOD)).places().isEmpty());server.verify();
    }
    @Test void rejectsAnUnsupportedProviderResponse() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();server.expect(anything()).andRespond(withSuccess("{}",MediaType.APPLICATION_JSON));
        assertThrows(IllegalStateException.class,()->new WikidataDiscoveryProvider(builder.build(),mock(WikimediaEnrichmentService.class)).discover(request(null)));server.verify();
    }
    @Test void namedLookupFiltersAtTheSourceAndIncludesCavesBeforeTheRowLimit() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andExpect(request -> {
            String query=org.springframework.web.util.UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams().getFirst("query");
            query=java.net.URLDecoder.decode(query,java.nio.charset.StandardCharsets.UTF_8);
            assertTrue(query.contains("wd:Q35509"));assertTrue(query.contains("wd:Q839954"));
            assertTrue(query.contains("FILTER(CONTAINS(LCASE(STR(?matchedName)), \"edakkal caves\"))"));
            assertTrue(query.indexOf("?matchedName") < query.indexOf("LIMIT 200"));
        }).andRespond(withSuccess("{\"results\":{\"bindings\":["+row("Q2372682","Edakkal Caves","Point(76.230541 11.631499)").replace("Q33506","Q35509")+","+row("Q999","Unrelated distant cave","Point(80 13)")+ "]}}",MediaType.APPLICATION_JSON));
        var req=new DiscoveryProviderRequest("Wayanadu",new GeocodedDestination(new BigDecimal("11.7"),new BigDecimal("76.1"),"Wayanad, Kerala, India",null,"Wayanad","Kerala","IN","Test"),25,null,"Edakkal Caves");
        var result=new WikidataDiscoveryProvider(builder.build(),mock(WikimediaEnrichmentService.class)).discover(req);
        assertEquals(1,result.places().size());assertEquals("wikidata:Q2372682",result.places().getFirst().externalId());
        assertEquals(DiscoveryCategory.NATURE,result.places().getFirst().category());server.verify();
    }
    @Test void namedLookupEscapesQuotesBackslashesAndControlCharacters() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andExpect(request -> {
            String query=java.net.URLDecoder.decode(org.springframework.web.util.UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams().getFirst("query"),java.nio.charset.StandardCharsets.UTF_8);
            assertTrue(query.contains("\\\""));assertTrue(query.contains("\\\\"));assertTrue(query.contains("\\u000a"));
        }).andRespond(withSuccess("{\"results\":{\"bindings\":[]}}",MediaType.APPLICATION_JSON));
        var base=request(null);
        new WikidataDiscoveryProvider(builder.build(),mock(WikimediaEnrichmentService.class)).discover(new DiscoveryProviderRequest(base.query(),base.destination(),25,null,"cave \" \\ \n end"));server.verify();
    }

    @Test void languageCoverageIsMappedAsProminenceWithoutInventingVisitorRatings() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        String data=row("Q1","Known museum","Point(80.271 13.083)");
        data=data.substring(0,data.length()-1)+",\"sitelinks\":{\"value\":\"42\"}}";
        server.expect(anything()).andRespond(withSuccess("{\"results\":{\"bindings\":["+data+"]}}",MediaType.APPLICATION_JSON));
        var result=new WikidataDiscoveryProvider(builder.build(),mock(WikimediaEnrichmentService.class)).discover(request(null));
        assertEquals(42,result.places().getFirst().popularityScore());assertNull(result.places().getFirst().rating());server.verify();
    }

}

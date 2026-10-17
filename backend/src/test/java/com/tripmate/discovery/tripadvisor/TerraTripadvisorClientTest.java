package com.tripmate.discovery.tripadvisor;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class TerraTripadvisorClientTest {
    private static final String LOCATION = """
      {"id":123,"names":[{"language":"en","value":"Garden","primary":true}],
       "addresses":[{"formatted":"Ooty, India"}],"descriptions":[{"language":"en","value":"A garden"}],
       "urls":{"tripadvisor":{"main":"https://www.tripadvisor.com/Attraction_Review-d123"}},
       "traveler_ratings":{"overall":{"count":42,"icon_url":"https://static.tacdn.com/rating.svg"}}}
      """;
    private TripadvisorBudget activeBudget() { var b=mock(TripadvisorBudget.class); when(b.terraConfigured()).thenReturn(true); return b; }
    @Test void searchesLicensedLocationsWithHeaderAuthAndReservesMaximumEntities() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var budget=activeBudget();
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://terra.tripadvisor.com/api/locations/search?")))
          .andExpect(header("X-API-Key","test-secret"))
          .andExpect(queryParam("version","1")).andExpect(queryParam("query","Ooty"))
          .andExpect(queryParam("category","ATTRACTION")).andExpect(queryParam("country_code","IN"))
          .andExpect(queryParam("size","10")).andExpect(r->assertFalse(r.getURI().toString().contains("test-secret")))
          .andRespond(withSuccess("{\"data\":[{\"location\":"+LOCATION+",\"matched_value\":{\"value\":\"Ooty\"}}]}",MediaType.APPLICATION_JSON));
        var results=new TerraTripadvisorClient(builder.build(),budget,"test-secret").search("Ooty","attractions");
        assertEquals(1,results.size());assertEquals("Garden",results.get(0).name());assertEquals("Ooty, India",results.get(0).address());assertTrue(results.get(0).webUrl().contains("tripadvisor.com"));
        verify(budget).reserveTerra(10);verify(budget,never()).reserve();server.verify();
    }
    @Test void readsDocumentedDetailsAndProviderBubbleImage() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var budget=activeBudget();
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://terra.tripadvisor.com/api/locations/123?"))).andRespond(withSuccess(LOCATION,MediaType.APPLICATION_JSON));
        var result=new TerraTripadvisorClient(builder.build(),budget,"test").details("123");
        assertEquals("A garden",result.description());assertEquals("42",result.reviewCount());assertEquals("https://static.tacdn.com/rating.svg",result.ratingImageUrl());
        verify(budget).reserveTerra(1);server.verify();
    }
    @Test void readsOriginalPhotosWithAuthorAndRejectsUntrustedOrWrongLocationMedia() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var budget=activeBudget();
        server.expect(queryParam("size","1")).andExpect(queryParam("page","1")).andRespond(withSuccess("""
          {"data":[{"location_id":999,"photo":{"original_size_url":"https://media-cdn.tripadvisor.com/other.jpg"},"source":{"name":"Traveler"}},
          {"location_id":123,"photo":{"original_size_url":"https://evil.example/photo.jpg"},"source":{"name":"Management"}},
          {"location_id":123,"photo":{"original_size_url":"https://dynamic-media-cdn.tripadvisor.com/photo.jpg"},"source":{"name":"Traveler"},"user":{"username":"Photographer"},"caption":"Garden"}]}
          """,MediaType.APPLICATION_JSON));
        var photos=new TerraTripadvisorClient(builder.build(),budget,"test").photos("123");
        assertEquals(1,photos.size());assertEquals("Photographer",photos.get(0).author());assertNull(photos.get(0).sourceUrl());server.verify();
    }
    @Test void disabledBudgetOrMissingKeyDoesNotMakeProviderCalls() {
        var budget=mock(TripadvisorBudget.class);var client=new TerraTripadvisorClient(RestClient.create(),budget,"test");
        assertFalse(client.available());assertEquals("TERRA_SETUP_REQUIRED",client.setupCode());
        assertThrows(ResponseStatusException.class,()->client.search("Ooty","attractions"));verify(budget,never()).reserveTerra(anyInt());
        assertFalse(new TerraTripadvisorClient(RestClient.create(),budget,"").available());
    }
    @Test void deniesAccessWithoutRetryAndNeverReturnsSecretProviderBody() {
        for (int status:new int[]{401,403,404,429,500}) {
            var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
            server.expect(anything()).andRespond(withStatus(HttpStatus.valueOf(status)).body("test-secret private provider payload"));
            var client=new TerraTripadvisorClient(builder.build(),activeBudget(),"test-secret");
            var error=assertThrows(TripadvisorFailure.class,()->client.details("123"));
            assertFalse(error.toString().contains("test-secret"));assertNull(error.getCause());
            if(status==403)assertEquals("TERRA_ACCESS_DENIED",error.code());
            if(status==404)assertEquals("LOCATION_ACCESS_REQUIRED",error.code());server.verify();
        }
    }
    @Test void invalidIdsAndUnsupportedResponsesDoNotInventPlaces() {
        var budget=activeBudget();var client=new TerraTripadvisorClient(RestClient.create(),budget,"test");
        assertThrows(ResponseStatusException.class,()->client.photos("../allowlist"));verify(budget,never()).reserveTerra(anyInt());
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();server.expect(anything()).andRespond(withSuccess("{}",MediaType.APPLICATION_JSON));
        assertThrows(TripadvisorFailure.class,()->new TerraTripadvisorClient(builder.build(),budget,"test").search("Ooty","attractions"));server.verify();
    }
}

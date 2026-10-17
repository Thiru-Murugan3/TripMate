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

class TripadvisorServiceTest {
    @Test void searchIsLiveAndUsesCategoryWithoutExposingKey() {
        var builder = RestClient.builder(); var server = MockRestServiceServer.bindTo(builder).build();
        var budget = mock(TripadvisorBudget.class); var service = new TripadvisorService(builder.build(), budget, "private-test-key");
        for (int i = 0; i < 2; i++) server.expect(queryParam("category", "attractions"))
                .andExpect(queryParam("searchQuery", "Ooty%20India"))
                .andRespond(withSuccess("{\"data\":[{\"location_id\":\"123\",\"name\":\"Garden\",\"address_obj\":{\"address_string\":\"Ooty\"}}]}", MediaType.APPLICATION_JSON));
        assertEquals("Garden", service.search("Ooty India", "attractions").get(0).name());
        service.search("Ooty India", "attractions");
        verify(budget, times(2)).reserve(); server.verify();
    }
    @Test void failedUpstreamNeverLeaksKeyOrResponseBody() {
        var builder = RestClient.builder(); var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED).body("secret-test-key"));
        var service = new TripadvisorService(builder.build(), mock(TripadvisorBudget.class), "secret-test-key");
        var ex = assertThrows(ResponseStatusException.class, () -> service.details("123"));
        assertEquals(502, ex.getStatusCode().value()); assertFalse(ex.toString().contains("secret-test-key"));
        assertNull(ex.getCause()); server.verify();
    }
    @Test void missingKeyInvalidIdsAndUnsupportedCategoriesMakeNoCalls() {
        var budget = mock(TripadvisorBudget.class);
        var service = new TripadvisorService(RestClient.create(), budget, "");
        assertFalse(service.available());
        assertThrows(ResponseStatusException.class, () -> service.search("Ooty", "attractions"));
        assertThrows(ResponseStatusException.class, () -> service.photos("../search"));
        assertThrows(ResponseStatusException.class, () -> service.search("Ooty", "anything"));
        verifyNoInteractions(budget);
    }
    @Test void quotaRejectsBeforeAnyNetworkAnd429IsRecoverable() {
        var budget = mock(TripadvisorBudget.class);
        doThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Limit reached")).when(budget).reserve();
        var blockedService = new TripadvisorService(RestClient.create(), budget, "test");
        assertEquals(429, assertThrows(ResponseStatusException.class, () -> blockedService.details("123")).getStatusCode().value());
        var builder = RestClient.builder(); var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        var service = new TripadvisorService(builder.build(), mock(TripadvisorBudget.class), "test");
        var finalService = service;
        assertEquals(429, assertThrows(ResponseStatusException.class, () -> finalService.photos("123")).getStatusCode().value()); server.verify();
    }
    @Test void photosRequireCreditAndTrustedHttpsUrls() {
        var builder = RestClient.builder(); var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withSuccess("""
          {"data":[{"images":{"large":{"url":"https://media-cdn.tripadvisor.com/photo.jpg"}},"photo_url":"https://www.tripadvisor.com/photo/1","user":{"username":"Photographer"}},
          {"images":{"large":{"url":"https://evil.example/photo.jpg"}},"photo_url":"https://www.tripadvisor.com/photo/2","user":{"username":"Other"}}]}
          """, MediaType.APPLICATION_JSON));
        var service = new TripadvisorService(builder.build(), mock(TripadvisorBudget.class), "test");
        assertEquals(1, service.photos("123").size()); server.verify();
        assertNull(TripadvisorService.safeUrl("javascript:alert(1)", false));
        assertNull(TripadvisorService.safeUrl("https://tripadvisor.com.evil.example/", false));
        assertNull(TripadvisorService.safeUrl("https://www.tripadvisor.com/?key=test", false));
    }
}

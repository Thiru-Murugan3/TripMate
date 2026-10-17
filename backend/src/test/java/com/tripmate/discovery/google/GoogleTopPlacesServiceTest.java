package com.tripmate.discovery.google;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripmate.discovery.provider.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GoogleTopPlacesServiceTest {
    private final ObjectMapper json=new ObjectMapper();
    private ProviderHttpClientFactory factory;
    private DestinationGeocodingService geocoding;
    private MockRestServiceServer server;
    private GoogleTopPlacesService service;
    private final String answer="1. Ooty Lake — A lake to visit.\n2. Government Botanical Garden — A garden.";
    private String response() {return """
        {"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":"1. Ooty Lake — A lake to visit.\\n2. Government Botanical Garden — A garden."}]},
          "groundingMetadata":{"webSearchQueries":["Ooty top tourist places"],
            "searchEntryPoint":{"renderedContent":"<style>.chip{color:green}</style><a href='https://www.google.com/search?q=Ooty'>Ooty</a>"},
            "groundingChunks":[{"web":{"uri":"https://tourism.example/ooty","title":"Ooty tourism"}}],
            "groundingSupports":[{"segment":{"text":"Ooty Lake"},"groundingChunkIndices":[0]}]}}]}
        """;}
    @BeforeEach void setup() {
        var builder=RestClient.builder();server=MockRestServiceServer.bindTo(builder).build();
        factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        geocoding=mock(DestinationGeocodingService.class);
        when(geocoding.geocode(anyString())).thenReturn(new GeocodedDestination(new BigDecimal("11.41"),new BigDecimal("76.69"),"Ooty, Tamil Nadu, India","Ooty",null,"Tamil Nadu","IN","Test"));
        service=new GoogleTopPlacesService(factory,geocoding,true,"private-test-key","gemini-3.5-flash-lite",50);
    }
    @Test void requestsGoogleSearchGroundingAndPreservesTheCompleteAnswerAndSuggestions() {
        server.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"))
                .andExpect(header("x-goog-api-key","private-test-key"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("google_search")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Ooty, Tamil Nadu, India")))
                .andRespond(withSuccess(response(),MediaType.APPLICATION_JSON));
        var result=service.search(1L,"Ooty");
        assertEquals(answer,result.text());assertEquals("https://tourism.example/ooty",result.sources().getFirst().url());
        assertEquals(jsonValue(response(),"/candidates/0/groundingMetadata/searchEntryPoint/renderedContent"),result.searchSuggestionsHtml());
        assertNotNull(result.checkedAt());server.verify();
    }
    private String jsonValue(String text,String path) {try{return json.readTree(text).at(path).asText();}catch(Exception ex){throw new RuntimeException(ex);}}
    @Test void disabledIntegrationDoesNotGeocodeOrCallGoogle() {
        var disabled=new GoogleTopPlacesService(factory,geocoding,false,"private-test-key","gemini-3.5-flash-lite",50);
        assertEquals(503,assertThrows(ResponseStatusException.class,()->disabled.search(1L,"Ooty")).getStatusCode().value());
        verifyNoInteractions(geocoding);server.verify();
    }
    @Test void missingKeyOrInvalidModelDoesNotCallGoogle() {
        assertThrows(ResponseStatusException.class,()->new GoogleTopPlacesService(factory,geocoding,true,"","gemini-3.5-flash-lite",50).search(1L,"Ooty"));
        assertThrows(ResponseStatusException.class,()->new GoogleTopPlacesService(factory,geocoding,true,"key","../bad",50).search(1L,"Ooty"));server.verify();
    }
    @Test void validatesIdentityAndDestinationBeforeSpendingQuota() {
        assertEquals(401,assertThrows(ResponseStatusException.class,()->service.search(null,"Ooty")).getStatusCode().value());
        assertEquals(400,assertThrows(ResponseStatusException.class,()->service.search(1L,"x")).getStatusCode().value());
        assertThrows(ResponseStatusException.class,()->service.search(1L,"a".repeat(181)));server.verify();
    }
    @Test void refusesUngroundedTruncatedOrUnsafeResponsesRatherThanInventingPlaces() throws Exception {
        for (String pointer:new String[]{"groundingChunks","groundingSupports","webSearchQueries","searchEntryPoint"}) {
            var node=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(response()).at("/candidates/0/groundingMetadata");node.remove(pointer);
            var root=json.readTree(response());((com.fasterxml.jackson.databind.node.ObjectNode)root.at("/candidates/0")).set("groundingMetadata",node);
            assertThrows(ResponseStatusException.class,()->service.map(root,"Ooty"));
        }
        assertThrows(ResponseStatusException.class,()->service.map(json.readTree(response().replace("STOP","MAX_TOKENS")),"Ooty"));
        assertThrows(ResponseStatusException.class,()->service.map(json.readTree(response().replace("https://tourism.example/ooty","javascript:alert(1)")),"Ooty"));
    }
    @Test void failuresAreSanitizedAndConsumedAttemptsStillCountTowardTheDailyLimit() {
        service=new GoogleTopPlacesService(factory,geocoding,true,"private-test-key","gemini-3.5-flash-lite",1);
        server.expect(anything()).andRespond(withServerError().body("private-test-key provider internals"));
        var failure=assertThrows(ResponseStatusException.class,()->service.search(1L,"Ooty"));
        assertFalse(failure.getReason().contains("private-test-key"));
        assertEquals(429,assertThrows(ResponseStatusException.class,()->service.search(2L,"Chennai")).getStatusCode().value());server.verify();
    }
    @Test void repeatedUserRequestsAreThrottledAndAnswersAreNotSharedFromACache() {
        server.expect(anything()).andRespond(withSuccess(response(),MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess(response().replace("A lake to visit.","Another live answer."),MediaType.APPLICATION_JSON));
        assertEquals(answer,service.search(1L,"Ooty").text());
        assertEquals(429,assertThrows(ResponseStatusException.class,()->service.search(1L,"Ooty")).getStatusCode().value());
        assertTrue(service.search(2L,"Ooty").text().contains("Another live answer."));server.verify();
    }
    @Test void responseIsNeverCachedByTheController() {
        var mock=mock(GoogleTopPlacesService.class);var principal=mock(com.tripmate.security.UserPrincipal.class);when(principal.getId()).thenReturn(1L);
        var response=new GoogleTopPlacesController(mock).search(principal,new GoogleTopPlacesController.Request("Ooty"));
        assertEquals("no-store",response.getHeaders().getCacheControl());assertEquals("no-cache",response.getHeaders().getFirst("Pragma"));
        verify(mock).search(1L,"Ooty");
    }
    @Test void distinguishesUpstreamFailuresWithoutLeakingAnyProviderData() {
        var cases=java.util.List.of(
                new Object[]{400,"API_KEY_INVALID","rejected the Gemini API key",503},
                new Object[]{403,"API_KEY_HTTP_REFERRER_BLOCKED","restrictions",503},
                new Object[]{403,"SERVICE_DISABLED","Generative Language API",503},
                new Object[]{403,"BILLING_DISABLED","billing",503},
                new Object[]{403,"","denied access",503},
                new Object[]{404,"","model is unavailable",503},
                new Object[]{429,"","quota",429},
                new Object[]{400,"","rejected the search request",503},
                new Object[]{503,"","temporarily unavailable",503});
        long user=10;
        for (Object[] c:cases) {
            server.reset();
            String body="{\"error\":{\"message\":\"private-test-key secret upstream contents\",\"details\":[{\"reason\":\""+c[1]+"\",\"metadata\":{\"project\":\"private-project\"}}]}}";
            server.expect(anything()).andRespond(withStatus(org.springframework.http.HttpStatus.valueOf((Integer)c[0])).contentType(MediaType.APPLICATION_JSON).body(body));
            long current=user++;
            var error=assertThrows(ResponseStatusException.class,()->service.search(current,"Ooty"));
            assertEquals(c[3],error.getStatusCode().value());assertTrue(error.getReason().contains((String)c[2]),error.getReason());
            assertFalse(error.getReason().contains("private-test-key"));assertFalse(error.getReason().contains("private-project"));server.verify();
        }
    }
    @Test void logsOnlyFixedFailureCategoriesRatherThanKeysBodiesOrUnknownReasonCodes() {
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(GoogleTopPlacesService.class);
        var appender=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();appender.start();logger.addAppender(appender);
        try {
            server.expect(anything()).andRespond(withBadRequest().contentType(MediaType.APPLICATION_JSON).body("{\"error\":{\"message\":\"private-test-key\",\"details\":[{\"reason\":\"private-test-key\"}]}}"));
            assertThrows(ResponseStatusException.class,()->service.search(1L,"Ooty"));
            String messages=appender.list.stream().map(ch.qos.logback.classic.spi.ILoggingEvent::getFormattedMessage).collect(java.util.stream.Collectors.joining());
            assertTrue(messages.contains("status=400 category=REQUEST_REJECTED"));assertFalse(messages.contains("private-test-key"));
            assertTrue(appender.list.stream().allMatch(e->e.getThrowableProxy()==null));server.verify();
        } finally {logger.detachAppender(appender);appender.stop();}
    }
    @Test void separatesNetworkAndTimeoutFailuresFromProviderRejections() {
        var builder=RestClient.builder();var local=MockRestServiceServer.bindTo(builder).build();
        var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        var service=new GoogleTopPlacesService(factory,geocoding,true,"private-test-key","gemini-3.5-flash-lite",50);
        local.expect(anything()).andRespond(request->{throw new java.net.SocketTimeoutException("private-test-key");});
        var timed=assertThrows(ResponseStatusException.class,()->service.search(1L,"Ooty"));
        assertEquals(504,timed.getStatusCode().value());assertTrue(timed.getReason().contains("too long"));assertFalse(timed.getReason().contains("private-test-key"));local.verify();
        local.reset();local.expect(anything()).andRespond(request->{throw new java.net.ConnectException("private-test-key");});
        var network=assertThrows(ResponseStatusException.class,()->service.search(2L,"Ooty"));
        assertEquals(503,network.getStatusCode().value());assertTrue(network.getReason().contains("could not connect"));local.verify();
    }

}

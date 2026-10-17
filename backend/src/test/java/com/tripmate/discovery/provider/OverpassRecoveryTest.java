package com.tripmate.discovery.provider;

import com.tripmate.discovery.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.math.BigDecimal;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class OverpassRecoveryTest {
    @Test void coolingDownBrokenEndpointStillAllowsTheConfiguredFallback() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
        server.expect(requestTo("https://primary.example/api/interpreter")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        server.expect(requestTo("https://fallback.example/api/interpreter")).andRespond(withSuccess("{\"elements\":[]}",MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://fallback.example/api/interpreter")).andRespond(withSuccess("{\"elements\":[]}",MediaType.APPLICATION_JSON));
        var provider=new OverpassDiscoveryProvider(factory,mock(PriceVerificationService.class),mock(ImageResolverService.class),mock(WikimediaEnrichmentService.class),
                "https://primary.example/api/interpreter,https://fallback.example/api/interpreter",500);
        var request=new DiscoveryProviderRequest("Chennai",new GeocodedDestination(new BigDecimal("13"),new BigDecimal("80"),"Chennai, India","Chennai",null,null,"IN","Test"),25,null);
        provider.discover(request);provider.discover(request);server.verify();
    }
}

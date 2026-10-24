package com.tripmate.discovery;
import com.tripmate.discovery.provider.ProviderHttpClientFactory;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
class RoadRoutingControllerTest {
 @Test void returnsProviderRoadLegsAndCachesTheOrderedRoute() {
  var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
  server.expect(queryParam("mode","drive")).andExpect(queryParam("units","metric")).andRespond(withSuccess("""
   {"features":[{"properties":{"distance":12000,"time":1800,"legs":[{"distance":12000,"time":1800}]},"geometry":{"type":"MultiLineString","coordinates":[[[77,11],[77.1,11.1]]]}}]}
   """,MediaType.APPLICATION_JSON));
  var service=new RoadRoutingController(factory,"secret");var request=new RoadRoutingController.Request(List.of(new RoadRoutingController.Point(11,77),new RoadRoutingController.Point(11.1,77.1)));
  var result=service.estimate(request);assertTrue(result.available());assertEquals(12,result.distanceKm());assertEquals(30,result.durationMinutes());assertEquals(List.of(11.0,77.0),result.path().getFirst());assertSame(result,service.estimate(request));server.verify();
 }
 @Test void unavailableRoutingNeverInventsTravelTimes() {
  var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(RestClient.create());
  var result=new RoadRoutingController(factory,"").estimate(new RoadRoutingController.Request(List.of(new RoadRoutingController.Point(11,77),new RoadRoutingController.Point(12,78))));
  assertFalse(result.available());assertNull(result.durationMinutes());assertTrue(result.legs().isEmpty());
 }
}

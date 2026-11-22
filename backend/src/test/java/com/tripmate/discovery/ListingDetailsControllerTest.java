package com.tripmate.discovery;
import com.tripmate.discovery.provider.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import java.math.BigDecimal;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
class ListingDetailsControllerTest {
 @Test void enrichesOnlyCachedExactObjectAndRetainsPublicIdentity() {
  var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(builder.build());
  var discovery=mock(DestinationDiscoveryService.class);var wiki=mock(WikimediaEnrichmentService.class);
  var base=DiscoveredPlace.builder().externalId("geoapify:test").name("Park").category(DiscoveryCategory.PARK).latitude(new BigDecimal("13")).longitude(new BigDecimal("80")).sourceUrl("https://www.openstreetmap.org/node/123").build();
  when(discovery.findByExternalId(base.externalId())).thenReturn(base);
  var mapper=new OverpassDiscoveryProvider(factory,new PriceVerificationService(30),new ImageResolverService(mock(CommonsImageService.class)),wiki,"",500);
  server.expect(requestTo("https://api.openstreetmap.org/api/0.6/node/123.json")).andRespond(withSuccess("""
   {"elements":[{"type":"node","id":123,"lat":13,"lon":80,"tags":{"name":"Park","leisure":"park","opening_hours":"09:00-17:00","fee":"no"}}]}
   """,MediaType.APPLICATION_JSON));
  var controller=new ListingDetailsController(discovery,mapper,factory,wiki);var result=controller.details(base.externalId());
  assertEquals(base.externalId(),result.externalId());assertEquals("09:00-17:00",result.openingHours());assertEquals(PriceStatus.FREE,result.priceStatus());assertTrue(result.imageGallery().isEmpty());
  assertSame(result,controller.details(base.externalId()));server.verify();
 }
 @Test void doesNotFetchArbitraryListingUrls() {
  var discovery=mock(DestinationDiscoveryService.class);var factory=mock(ProviderHttpClientFactory.class);when(factory.create(anyInt())).thenReturn(RestClient.create());
  var base=DiscoveredPlace.builder().externalId("provider:test").name("Park").category(DiscoveryCategory.PARK).sourceUrl("https://untrusted.example/private").build();when(discovery.findByExternalId(base.externalId())).thenReturn(base);
  var controller=new ListingDetailsController(discovery,mock(OverpassDiscoveryProvider.class),factory,mock(WikimediaEnrichmentService.class));assertSame(base,controller.details(base.externalId()));
 }
}

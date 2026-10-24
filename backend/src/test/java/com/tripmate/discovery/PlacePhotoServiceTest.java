package com.tripmate.discovery;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
class PlacePhotoServiceTest {
 @Test void resolvesRegionalArticleOnlyFromAnExactOsmObject(){
  var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var commons=mock(CommonsImageService.class);
  server.expect(requestTo("https://api.openstreetmap.org/api/0.6/node/123.json")).andRespond(withSuccess("""
   {"elements":[{"type":"node","id":123,"tags":{"wikipedia":"ta:அருங்காட்சியகம்"}}]}
   """,MediaType.APPLICATION_JSON));
  server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://ta.wikipedia.org/w/api.php"))).andRespond(withSuccess("""
   {"query":{"pages":{"1":{"pageprops":{"wikibase_item":"Q123"},"original":{"source":"https://upload.wikimedia.org/One.jpg"}}}}}
   """,MediaType.APPLICATION_JSON));
  server.expect(requestTo("https://www.wikidata.org/wiki/Special:EntityData/Q123.json")).andRespond(withSuccess("{\"entities\":{\"Q123\":{\"claims\":{}}}}",MediaType.APPLICATION_JSON));
  when(commons.resolveUrl("https://upload.wikimedia.org/One.jpg")).thenReturn(photo("One.jpg"));
  when(commons.depicting("Q123")).thenReturn(List.of(photo("Two.jpg")));
  var result=new PlacePhotoService(builder.build(),commons).photos("osm:node:123");assertEquals(2,result.images().size());server.verify();
 }
 @Test void rejectsAnOsmResponseForAnotherObject(){
  var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var commons=mock(CommonsImageService.class);
  server.expect(anything()).andRespond(withSuccess("{\"elements\":[{\"type\":\"way\",\"id\":123,\"tags\":{\"wikidata\":\"Q123\"}}]}",MediaType.APPLICATION_JSON));
  var result=new PlacePhotoService(builder.build(),commons).photos("osm:node:123");assertTrue(result.images().isEmpty());assertTrue(result.retryable());verifyNoInteractions(commons);server.verify();
 }
 @Test void resolvesCommonsFilePageLinksWithTheFilesOwnCredit(){
  var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
  server.expect(queryParam("titles","File:Real_place.jpg")).andRespond(withSuccess("{\"query\":{\"pages\":{}}}",MediaType.APPLICATION_JSON));
  new CommonsImageService(builder.build()).resolveUrl("https://commons.wikimedia.org/wiki/File:Real_place.jpg");server.verify();
 }
 static DiscoveryImage photo(String file){return new DiscoveryImage("https://upload.wikimedia.org/"+file,"https://commons.wikimedia.org/wiki/File:"+file,"Wikimedia Commons","Photographer","CC BY-SA 4.0","Photographer",true,true);}
 @Test void returnsTwoDistinctEntityPhotosAndCachesWithoutNameSearch(){
  var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var commons=mock(CommonsImageService.class);
  server.expect(requestTo("https://www.wikidata.org/wiki/Special:EntityData/Q123.json")).andRespond(withSuccess("{\"entities\":{\"Q123\":{\"claims\":{\"P18\":[{\"mainsnak\":{\"datavalue\":{\"value\":\"One.jpg\"}}},{\"mainsnak\":{\"datavalue\":{\"value\":\"One.jpg\"}}},{\"mainsnak\":{\"datavalue\":{\"value\":\"Two.jpg\"}}}]}}}}",MediaType.APPLICATION_JSON));
  when(commons.resolve("File:One.jpg")).thenReturn(photo("One.jpg"));when(commons.resolve("File:Two.jpg")).thenReturn(photo("Two.jpg"));
  var service=new PlacePhotoService(builder.build(),commons);var result=service.photos("wikidata:Q123");
  assertEquals(2,result.images().size());assertSame(result,service.photos("wikidata:Q123"));verify(commons,never()).depicting(anyString());server.verify();
 }
 @Test void supplementsOnePhotoOnlyThroughExactDepictsIdentity(){
  var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var commons=mock(CommonsImageService.class);
  server.expect(anything()).andRespond(withSuccess("{\"entities\":{\"Q123\":{\"claims\":{}}}}",MediaType.APPLICATION_JSON));
  when(commons.depicting("Q123")).thenReturn(List.of(photo("One.jpg")));
  var result=new PlacePhotoService(builder.build(),commons).photos("wikidata:Q123");assertEquals(1,result.images().size());assertTrue(result.message().contains("Only 1"));assertFalse(result.retryable());server.verify();
 }
 @Test void rejectsArbitraryAddressesAndDoesNotCacheTemporaryFailures(){
  var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();var service=new PlacePhotoService(builder.build(),mock(CommonsImageService.class));
  assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.photos("https://example.com/photo"));
  server.expect(anything()).andRespond(withServerError());server.expect(anything()).andRespond(withServerError());
  assertTrue(service.photos("wikidata:Q123").retryable());assertTrue(service.photos("wikidata:Q123").retryable());server.verify();
 }
 @Test void excludesUncreditedGeneratedOrNonPhotographicFiles() throws Exception {
  String valid="{\"query\":{\"pages\":{\"1\":{\"imageinfo\":[{\"mime\":\"image/jpeg\",\"thumburl\":\"https://upload.wikimedia.org/One.jpg\",\"descriptionurl\":\"https://commons.wikimedia.org/wiki/File:One.jpg\",\"extmetadata\":{\"Artist\":{\"value\":\"Author\"},\"LicenseShortName\":{\"value\":\"CC BY-SA 4.0\"},\"Categories\":{\"value\":\"Photographs\"}}}]}}}}";
  var service=new CommonsImageService(RestClient.create());var json=new ObjectMapper();assertNotNull(service.fromResponse(json.readTree(valid)));
  for(String bad:List.of(valid.replace("Photographs","AI-generated images"),valid.replace("image/jpeg","image/svg+xml"),valid.replace("CC BY-SA 4.0","All rights reserved"),valid.replace("upload.wikimedia.org","evil.test")))assertNull(service.fromResponse(json.readTree(bad)));
 }
}

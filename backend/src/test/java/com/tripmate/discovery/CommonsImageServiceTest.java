package com.tripmate.discovery;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.http.MediaType;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class CommonsImageServiceTest {
    private static final String METADATA = """
      {"query":{"pages":{"1":{"imageinfo":[{"mime":"image/jpeg","thumburl":"https://upload.wikimedia.org/photo.jpg",
      "descriptionurl":"https://commons.wikimedia.org/wiki/File:Photo.jpg","extmetadata":{
      "Artist":{"value":"<a href='https://example.test'>A &amp; B</a>"},
      "LicenseShortName":{"value":"CC BY-SA 4.0"},"Credit":{"value":"Own work"}}}]}}}}
      """;
    @Test void resolvesAndCachesActualFileAttribution() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(org.hamcrest.Matchers.containsString("commons.wikimedia.org/w/api.php")))
                .andRespond(withSuccess(METADATA, MediaType.APPLICATION_JSON));
        var service = new CommonsImageService(builder.build());
        var image = service.resolve("File:Photo.jpg");
        assertNotNull(image);
        assertEquals("A & B", image.author());
        assertEquals("CC BY-SA 4.0", image.license());
        assertEquals("A & B · Own work", image.attribution());
        assertSame(image, service.resolve("File:Photo.jpg"));
        server.verify();
    }
    @Test void missingLicenceOrFailedLookupDoesNotInventCredit() throws Exception {
        var service = new CommonsImageService(RestClient.create());
        assertNull(service.fromResponse(new ObjectMapper().readTree(METADATA.replace("CC BY-SA 4.0", ""))));
        assertNull(service.resolveUrl("https://example.test/unrelated.jpg"));
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withServerError());
        assertNull(new CommonsImageService(builder.build()).resolve("File:Missing.jpg"));
        server.verify();
    }
    @Test void uncreditedExternalImageStaysPlaceholder() throws Exception {
        var resolver = new ImageResolverService(mock(CommonsImageService.class));
        var tags = new ObjectMapper().readTree("{\"image\":\"https://example.test/image.jpg\"}");
        assertNull(resolver.fromOpenStreetMap(tags, "https://osm.example/1").primary());
    }
}

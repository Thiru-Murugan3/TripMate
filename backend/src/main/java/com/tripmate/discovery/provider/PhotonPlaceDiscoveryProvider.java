package com.tripmate.discovery.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import java.util.List;
import java.util.Locale;

/** User-submitted name lookup, independent of broad inventory caps and Wikidata classes. */
@Component
@Order(45)
public class PhotonPlaceDiscoveryProvider implements DiscoveryProvider {
    private final RestClient client;
    private final String baseUrl;
    private final OverpassDiscoveryProvider mapper;

    public PhotonPlaceDiscoveryProvider(ProviderHttpClientFactory factory, OverpassDiscoveryProvider mapper,
            @Value("${discovery.photon-url:https://photon.komoot.io}") String baseUrl) {
        this.client = factory.create(12000);
        this.mapper = mapper;
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }
    @Override public String name() { return "OpenStreetMap name search"; }
    @Override public DiscoveryProviderResult discover(DiscoveryProviderRequest request) {
        if (request.placeName() == null || request.placeName().isBlank() || !request.destination().isIndia())
            return new DiscoveryProviderResult(name(), "", List.of(), List.of());
        double lat = request.destination().latitude().doubleValue(), lon = request.destination().longitude().doubleValue();
        double dy = request.radiusKm()/110.5, dx = request.radiusKm()/(110.5*Math.cos(Math.toRadians(lat)));
        String box = String.format(Locale.ROOT,"%.6f,%.6f,%.6f,%.6f",lon-dx,lat-dy,lon+dx,lat+dy);
        var uri = UriComponentsBuilder.fromUri(ProviderUrlSupport.uri(baseUrl,"/api"))
                .queryParam("q",request.placeName().trim()).queryParam("lat",lat).queryParam("lon",lon)
                .queryParam("bbox",box).queryParam("countrycode","IN").queryParam("lang","en")
                .queryParam("limit",20).build().encode().toUri();
        JsonNode response = client.get().uri(uri).retrieve().body(JsonNode.class);
        JsonNode features = response == null ? null : response.path("features");
        if (features == null || !features.isArray()) throw new IllegalStateException("Unsupported Photon response");
        var elements = JsonNodeFactory.instance.arrayNode();
        for (JsonNode feature : features) {
            JsonNode p = feature.path("properties"), coords = feature.path("geometry").path("coordinates");
            if (!"IN".equalsIgnoreCase(p.path("countrycode").asText()) || !coords.isArray() || coords.size()<2) continue;
            String type = switch(p.path("osm_type").asText()) { case "N" -> "node"; case "W" -> "way"; case "R" -> "relation"; default -> ""; };
            String id=p.path("osm_id").asText(), label=p.path("name").asText();
            if (type.isEmpty() || !id.matches("[1-9][0-9]*") || label.isBlank()) continue;
            ObjectNode tags=p.path("extra").isObject() ? ((ObjectNode)p.path("extra")).deepCopy() : JsonNodeFactory.instance.objectNode();
            tags.put("name",label);
            String key=p.path("osm_key").asText(), value=p.path("osm_value").asText();
            if (!isRelevantPlace(key,value,request.category())) continue;
            tags.put(key,value);
            for (String field : List.of("city","district","state")) if (p.path(field).isTextual()) tags.put("addr:"+field,p.path(field).asText());
            var element=elements.addObject().put("type",type).put("id",id);
            element.set("lon",coords.get(0));element.set("lat",coords.get(1));element.set("tags",tags);
        }
        ObjectNode osm=JsonNodeFactory.instance.objectNode();osm.set("elements",elements);
        // The existing OSM mapper independently verifies the circular radius, category, fees and image credits.
        var places=mapper.map(osm,request);
        return new DiscoveryProviderResult(name(),"© OpenStreetMap contributors · Photon name lookup",places,
                features.size()>=20 ? List.of("OpenStreetMap name search returned its 20-match limit; refine the place name.") : List.of());
    }
    private boolean isRelevantPlace(String key, String value, com.tripmate.discovery.DiscoveryCategory category) {
        if (key.matches("tourism|historic|natural|leisure|sport")) return !value.isBlank();
        if (key.equals("waterway")) return value.equals("river");
        if (key.equals("man_made")) return value.matches("lighthouse|tower|dam");
        if (key.equals("shop")) return category == com.tripmate.discovery.DiscoveryCategory.SHOPPING;
        return key.equals("amenity") && value.matches("place_of_worship|arts_centre|theatre|events_venue|cinema|marketplace|restaurant|cafe|fast_food|food_court|bar|pub|nightclub");
    }
}

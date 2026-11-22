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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import com.tripmate.discovery.*;
import java.util.Locale;

/** User-submitted name lookup, independent of broad inventory caps and Wikidata classes. */
@Component
@Order(45)
public class PhotonPlaceDiscoveryProvider implements DiscoveryProvider {
    private final RestClient client;
    private final String baseUrl;
    private final RestClient fallbackClient;
    private final RestClient detailClient;
    private final OverpassDiscoveryProvider mapper;

    public PhotonPlaceDiscoveryProvider(ProviderHttpClientFactory factory, OverpassDiscoveryProvider mapper,
            @Value("${discovery.photon-url:https://photon.komoot.io}") String baseUrl) {
        this.client = factory.create(12000);
        this.fallbackClient = factory.create(4000);
        this.detailClient = factory.create(3000);
        this.mapper = mapper;
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }
    @Override public String name() { return "OpenStreetMap name search"; }
    @Override public DiscoveryProviderResult discover(DiscoveryProviderRequest request) {
        if (!request.destination().isIndia()) return new DiscoveryProviderResult(name(), "", List.of(), List.of());
        var detailBudget=new java.util.concurrent.atomic.AtomicInteger(request.fast()?0:2);
        if (request.placeName() != null && !request.placeName().isBlank()) return lookup(request,request.placeName().trim(),client,detailBudget);
        var terms = fallbackTerms(request.category());
        var places = new LinkedHashMap<String,DiscoveredPlace>();
        var warnings = new ArrayList<String>();
        if(request.fast()) {
            var sources=terms.stream().map(term->new DiscoveryProvider(){
                public String name(){return "OpenStreetMap interest lookup";}
                public DiscoveryProviderResult discover(DiscoveryProviderRequest ignored){return lookup(request,term,fallbackClient,detailBudget);}
            }).map(provider->(DiscoveryProvider)provider).toList();
            for(var outcome:DiscoveryBatch.fetch(sources,request,java.time.Duration.ofSeconds(6))) {
                var result=outcome.value();result.places().forEach(place->places.putIfAbsent(place.externalId(),place));warnings.addAll(result.warnings());
            }
        }
        for (String term : request.fast() ? List.<String>of() : terms) {
            try {
                var result=lookup(request,term,fallbackClient,detailBudget);
                result.places().forEach(place->places.putIfAbsent(place.externalId(),place));
                warnings.addAll(result.warnings());

            } catch (RuntimeException ex) {
                warnings.add("OpenStreetMap interest lookup was unavailable for part of this search.");
            }
        }
        if (!terms.isEmpty()) warnings.add("Interest lookup is a limited name search, not a complete destination inventory.");
        return new DiscoveryProviderResult(name(),"© OpenStreetMap contributors · Photon name lookup",List.copyOf(places.values()),warnings.stream().distinct().toList());
    }
    private List<String> fallbackTerms(DiscoveryCategory category) {
        if(category==null) return List.of();
        return switch(category) {
            case ADVENTURE -> List.of("rafting","bungee","adventure");
            case FAMILY -> List.of("park","museum","zoo");
            case NATURE -> List.of("waterfall","lake","viewpoint");
            case TEMPLE -> List.of("temple");
            case MUSEUM -> List.of("museum");
            default -> List.of();
        };
    }
    private DiscoveryProviderResult lookup(DiscoveryProviderRequest request,String term,RestClient searchClient,java.util.concurrent.atomic.AtomicInteger detailBudget) {
        double lat = request.destination().latitude().doubleValue(), lon = request.destination().longitude().doubleValue();
        double dy = request.radiusKm()/110.5, dx = request.radiusKm()/(110.5*Math.cos(Math.toRadians(lat)));
        String box = String.format(Locale.ROOT,"%.6f,%.6f,%.6f,%.6f",lon-dx,lat-dy,lon+dx,lat+dy);
        var uri = UriComponentsBuilder.fromUri(ProviderUrlSupport.uri(baseUrl,"/api"))
                .queryParam("q",term).queryParam("lat",lat).queryParam("lon",lon)
                .queryParam("bbox",box).queryParam("countrycode","IN").queryParam("lang","en")
                .queryParam("limit",20).build().encode().toUri();
        JsonNode response = searchClient.get().uri(uri).retrieve().body(JsonNode.class);
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
        // Enrich a few matched identities, never an arbitrary name or URL.
        var enriched=new ArrayList<DiscoveredPlace>();
        for(var place:places) {
            var value=place;
            if(detailBudget.getAndDecrement() > 0) {
                try {
                    String[] identity=place.externalId().split(":");
                    var detail=detailClient.get().uri(java.net.URI.create("https://api.openstreetmap.org/api/0.6/"+identity[1]+"/"+identity[2]+".json")).retrieve().body(JsonNode.class);
                    if(detail!=null && detail.path("elements").isArray()) {
                        var exact=JsonNodeFactory.instance.arrayNode();
                        for(var element:detail.path("elements")) if(element.path("id").asText().equals(identity[2]) && element.path("type").asText().equals(identity[1])) {
                            var record=element.deepCopy();
                            if(record instanceof ObjectNode object && !object.has("lat") && !object.has("center")) object.put("lat",place.latitude()).put("lon",place.longitude());
                            exact.add(record);
                        }
                        var records=mapper.map(JsonNodeFactory.instance.objectNode().set("elements",exact),request);
                        if(!records.isEmpty())value=records.getFirst();
                    }
                } catch(RuntimeException ignored) { /* Keep the independently sourced basic record. */ }
            }
            enriched.add(ReviewedAdventureFacts.apply(value));
        }
        places=List.copyOf(enriched);
        return new DiscoveryProviderResult(name(),"© OpenStreetMap contributors · Photon name lookup",places,
                features.size()>=20 ? List.of("OpenStreetMap name search returned its 20-match limit; refine the place name.") : List.of());
    }
    private boolean isRelevantPlace(String key, String value, com.tripmate.discovery.DiscoveryCategory category) {
        if (key.matches("tourism|historic|natural|leisure|sport")) return !value.isBlank();
        if (key.equals("office") && value.matches("travel_agent|tourism")) return true;
        if (key.equals("waterway")) return value.equals("river");
        if (key.equals("man_made")) return value.matches("lighthouse|tower|dam");
        if (key.equals("shop")) return category == com.tripmate.discovery.DiscoveryCategory.SHOPPING;
        return key.equals("amenity") && value.matches("place_of_worship|arts_centre|theatre|events_venue|cinema|marketplace|restaurant|cafe|fast_food|food_court|bar|pub|nightclub");
    }
}

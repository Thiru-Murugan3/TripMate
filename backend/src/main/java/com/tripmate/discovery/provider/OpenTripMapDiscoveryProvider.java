package com.tripmate.discovery.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tripmate.discovery.*;
import com.tripmate.place.PlaceCategory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** Optional provider: explicit opt-in because the published free plan is non-commercial. */
@Component
@Order(40)
public class OpenTripMapDiscoveryProvider implements DiscoveryProvider {
    private final RestClient client;
    private final WikimediaEnrichmentService enrichment;
    private final boolean enabled;
    private final String key;
    @org.springframework.beans.factory.annotation.Autowired
    public OpenTripMapDiscoveryProvider(ProviderHttpClientFactory factory, WikimediaEnrichmentService enrichment,
            @Value("${discovery.opentripmap.enabled:false}") boolean enabled,
            @Value("${discovery.opentripmap.api-key:}") String key) {
        this(factory.create(8000), enrichment, enabled, key);
    }
    OpenTripMapDiscoveryProvider(RestClient client, WikimediaEnrichmentService enrichment, boolean enabled, String key) {
        this.client=client; this.enrichment=enrichment; this.enabled=enabled; this.key=key==null ? "" : key.trim();
    }
    @Override public String name() { return "OpenTripMap"; }
    @Override public DiscoveryProviderResult discover(DiscoveryProviderRequest request) {
        if (!enabled || key.isBlank()) return new DiscoveryProviderResult(name(), "", List.of(),
                List.of("OpenTripMap is inactive until its API key and an appropriate usage plan are configured."));
        var destination=request.destination();
        var uri=UriComponentsBuilder.fromUriString("https://api.opentripmap.com/0.1/en/places/radius")
                .queryParam("radius", request.radiusKm()*1000).queryParam("lon",destination.longitude())
                .queryParam("lat",destination.latitude()).queryParam("format","json").queryParam("limit",100)
                .queryParam("kinds",kinds(request.category())).queryParam("apikey",key).build().encode().toUri();
        JsonNode response=client.get().uri(uri).retrieve().body(JsonNode.class);
        if(response==null || !response.isArray()) throw new IllegalStateException("Unsupported OpenTripMap response");
        List<DiscoveredPlace> places=new ArrayList<>(); int enrichmentBudget=4;
        for(JsonNode node:response) {
            String xid=node.path("xid").asText(""), name=node.path("name").asText("").trim();
            if(!xid.matches("[A-Za-z0-9_-]{1,100}") || name.isBlank()) continue;
            JsonNode point=node.path("point");
            if(!point.path("lat").isNumber() || !point.path("lon").isNumber()) continue;
            double lat=point.path("lat").asDouble(), lon=point.path("lon").asDouble();
            if(!Double.isFinite(lat) || !Double.isFinite(lon) || lat<6 || lat>38 || lon<68 || lon>98) continue;
            double distance=distance(destination.latitude().doubleValue(),destination.longitude().doubleValue(),lat,lon);
            if(distance>request.radiusKm()+0.2) continue;
            DiscoveryCategory category=classify(node.path("kinds").asText(""), name);
            if(!DiscoveryCategoryMatching.matches(request.category(), category)) continue;
            var extra=WikimediaEnrichmentService.Enrichment.empty();
            String wikidata=node.path("wikidata").asText("");
            if(wikidata.matches("Q[0-9]+") && enrichmentBudget-- > 0) {
                try { var resolved=enrichment.resolve(JsonNodeFactory.instance.objectNode().put("wikidata",wikidata)); if(resolved!=null)extra=resolved; }
                catch(RuntimeException ignored) { /* The sourced place survives optional enrichment failure. */ }
            }
            var image=extra.image();
            places.add(DiscoveredPlace.builder().externalId("opentripmap:"+xid).name(name).category(category)
                    .latitude(BigDecimal.valueOf(lat)).longitude(BigDecimal.valueOf(lon)).distanceKm(Math.round(distance*10)/10.0)
                    .description(extra.description()).saveCategory(saveCategory(category)).city(destination.city())
                    .district(destination.district()).state(destination.state()).imageGallery(extra.gallery())
                    .primaryImageUrl(image==null?null:image.url()).imageSource(image==null?null:image.sourceName())
                    .imageAttribution(image==null?null:image.attribution()).imageLicense(image==null?null:image.license())
                    .imageExact(image!=null && image.exact()).sourceName("OpenTripMap · OpenStreetMap/Wikidata · ODbL")
                    .sourceUrl("https://opentripmap.com/en/card/"+xid).sourceLastCheckedAt(Instant.now()).confidenceScore(.70)
                    .priceStatus(PriceStatus.UNKNOWN).priceType(PriceType.UNKNOWN).currency("INR")
                    .mapUrl("https://www.google.com/maps/dir/?api=1&destination="+lat+","+lon).build());
            if(places.size()==100)break;
        }
        List<String> warnings= response.size()>=100 ? List.of("OpenTripMap returned its configured 100-place search limit; this is not an exhaustive destination inventory.") : List.of();
        return new DiscoveryProviderResult(name(),"Places © OpenTripMap / OpenStreetMap contributors, ODbL; Wikidata CC0; Wikimedia photos where credited",places,warnings);
    }
    private String kinds(DiscoveryCategory category) {
        if(category==DiscoveryCategory.FOOD)return "foods";
        if(category==DiscoveryCategory.STAY)return "accomodations";
        if(category==DiscoveryCategory.SHOPPING)return "shops";
        return "interesting_places";
    }
    private DiscoveryCategory classify(String kinds, String name) {
        Set<String> tags=new HashSet<>(Arrays.asList(kinds.split(",")));
        String lower=name.toLowerCase(Locale.ROOT);
        if(tags.contains("campings") || tags.contains("campsites") || lower.matches(".*\\b(campsite|campground)\\b.*") && !lower.contains("museum")) return DiscoveryCategory.STAY;
        if(tags.contains("zoos") || tags.contains("aquariums")) return DiscoveryCategory.FAMILY;
        if(tags.contains("nature_reserves")) return DiscoveryCategory.WILDLIFE;
        if(tags.contains("amusements"))return DiscoveryCategory.ENTERTAINMENT;
        if(tags.contains("sport"))return DiscoveryCategory.ADVENTURE;
        if(tags.contains("waterfalls"))return DiscoveryCategory.WATERFALL;
        if(tags.contains("beaches"))return DiscoveryCategory.BEACH;
        if(tags.contains("lakes"))return DiscoveryCategory.LAKE;
        if(tags.contains("view_points"))return DiscoveryCategory.VIEWPOINT;
        if(tags.contains("hindu_temples") || tags.contains("buddhist_temples"))return DiscoveryCategory.TEMPLE;
        if(tags.contains("churches"))return DiscoveryCategory.CHURCH;
        if(tags.contains("gardens_and_parks"))return DiscoveryCategory.PARK;
        if(tags.contains("museums"))return DiscoveryCategory.MUSEUM;
        if(tags.contains("natural"))return DiscoveryCategory.NATURE;
        if(tags.contains("historic"))return DiscoveryCategory.HISTORICAL;
        if(tags.contains("foods"))return DiscoveryCategory.FOOD;
        if(tags.contains("accomodations"))return DiscoveryCategory.STAY;
        if(tags.contains("shops"))return DiscoveryCategory.SHOPPING;
        return DiscoveryCategory.ATTRACTION;
    }
    private PlaceCategory saveCategory(DiscoveryCategory category) {
        return category==DiscoveryCategory.ADVENTURE || category==DiscoveryCategory.ENTERTAINMENT || category==DiscoveryCategory.FAMILY ? PlaceCategory.ACTIVITY:
                category==DiscoveryCategory.FOOD?PlaceCategory.RESTAURANT:category==DiscoveryCategory.STAY?PlaceCategory.HOTEL:
                category==DiscoveryCategory.SHOPPING?PlaceCategory.SHOPPING:PlaceCategory.ATTRACTION;
    }
    private double distance(double a,double b,double c,double d) {
        double x=Math.sin(Math.toRadians(c-a)/2), y=Math.sin(Math.toRadians(d-b)/2);
        double h=x*x+Math.cos(Math.toRadians(a))*Math.cos(Math.toRadians(c))*y*y;
        return 6371.0088*2*Math.asin(Math.min(1,Math.sqrt(h)));
    }
}

package com.tripmate.discovery;

import com.tripmate.discovery.provider.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.util.List;

/** Lazy, cached enrichment, restricted to identities from a prior authenticated search. */
@RestController
@RequestMapping("/api/v1/discovery/place-details")
public class ListingDetailsController {
    private final DestinationDiscoveryService discovery;
    private final OverpassDiscoveryProvider mapper;
    private final RestClient client;private final WikimediaEnrichmentService wiki;
    private final ExpiringCache<String,DiscoveredPlace> cache=new ExpiringCache<>(256);
    public ListingDetailsController(DestinationDiscoveryService discovery,OverpassDiscoveryProvider mapper,ProviderHttpClientFactory factory,WikimediaEnrichmentService wiki) {
        this.discovery=discovery;this.mapper=mapper;this.client=factory.create(3000);this.wiki=wiki;
    }
    @GetMapping public DiscoveredPlace details(@RequestParam String externalId) {
        if(externalId==null||externalId.length()>220)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Invalid place identity");
        var base=discovery.findByExternalId(externalId);
        if(base.curated())return base;
        var cached=cache.get(externalId);if(cached!=null)return cached;
        String identity=base.externalId();
        if(!identity.matches("osm:(node|way|relation):[1-9][0-9]{0,18}")) {
            try {var u=URI.create(base.sourceUrl());if("https".equals(u.getScheme()) && List.of("www.openstreetmap.org","openstreetmap.org").contains(u.getHost())
                    && u.getPath().matches("/(node|way|relation)/[1-9][0-9]{0,18}")) identity="osm:"+u.getPath().substring(1).replace('/',':');}
            catch(RuntimeException ignored) {}
        }
        if(!identity.matches("osm:(node|way|relation):[1-9][0-9]{0,18}")) {
            String id=base.externalId().startsWith("wikidata:")?base.externalId().substring(9):"";
            try {var source=URI.create(base.sourceUrl());if("https".equals(source.getScheme())&&"www.wikidata.org".equals(source.getHost())&&source.getPath().matches("/wiki/Q[1-9][0-9]{0,14}"))id=source.getPath().substring(6);}catch(RuntimeException ignored){}
            if(id.matches("Q[1-9][0-9]{0,14}"))try {
                var extra=wiki.resolve(JsonNodeFactory.instance.objectNode().put("wikidata",id));
                if(extra!=null) {var detail=base.toBuilder().description(extra.description()==null?base.description():extra.description())
                    .shortDescription(extra.description()==null?base.shortDescription():extra.description())
                    .imageGallery(extra.gallery().isEmpty()?base.imageGallery():extra.gallery()).build();cache.put(externalId,detail,Instant.now().plusSeconds(300));return detail;}
            }catch(RuntimeException ignored){}
            return base;
        }
        try {
            var parts=identity.split(":");
            JsonNode raw=client.get().uri(URI.create("https://api.openstreetmap.org/api/0.6/"+parts[1]+"/"+parts[2]+".json")).retrieve().body(JsonNode.class);
            var exact=JsonNodeFactory.instance.arrayNode();
            if(raw!=null)for(var item:raw.path("elements")) if(parts[1].equals(item.path("type").asText())&&parts[2].equals(item.path("id").asText())) {
                var copy=(com.fasterxml.jackson.databind.node.ObjectNode)item.deepCopy();
                if(!copy.has("lat"))copy.put("lat",base.latitude()).put("lon",base.longitude());exact.add(copy);
            }
            var destination=new GeocodedDestination(base.latitude(),base.longitude(),base.name(),base.city(),base.district(),base.state(),"IN","Source");
            var result=mapper.map(JsonNodeFactory.instance.objectNode().set("elements",exact),new DiscoveryProviderRequest(base.name(),destination,1,null));
            if(result.isEmpty())return base;
            var mapped=ReviewedAdventureFacts.apply(result.getFirst());
            var detail=mapped.toBuilder().externalId(base.externalId())
                    .openingHours(mapped.openingHours()==null?base.openingHours():mapped.openingHours())
                    .imageGallery(mapped.imageGallery().isEmpty()?base.imageGallery():mapped.imageGallery())
                    .priceOptions(mapped.priceStatus()==PriceStatus.UNKNOWN?base.priceOptions():mapped.priceOptions())
                    .priceStatus(mapped.priceStatus()==PriceStatus.UNKNOWN?base.priceStatus():mapped.priceStatus())
                    .estimatedCostPerPerson(mapped.estimatedCostPerPerson()==null?base.estimatedCostPerPerson():mapped.estimatedCostPerPerson())
                    .verificationExpiresAt(mapped.priceStatus()==PriceStatus.UNKNOWN?base.verificationExpiresAt():mapped.verificationExpiresAt()).build();
            cache.put(externalId,detail,Instant.now().plusSeconds(300));return detail;
        } catch(RuntimeException ex) {return base;}
    }
}

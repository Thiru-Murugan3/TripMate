package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.provider.ProviderHttpClientFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.Semaphore;

/** Exact source identities only. Never substitutes photos from nearby/name-only matches. */
@Service
public class PlacePhotoService {
    private final RestClient client;
    private final CommonsImageService commons;
    private final ExpiringCache<String, Gallery> cache = new ExpiringCache<>(512);
    private final Semaphore requests = new Semaphore(4);
    @Autowired public PlacePhotoService(ProviderHttpClientFactory factory, CommonsImageService commons) {
        this(factory.create(5000), commons);
    }
    PlacePhotoService(RestClient client, CommonsImageService commons) { this.client=client; this.commons=commons; }
    public Gallery photos(String sourceId) {
        if (sourceId == null || !sourceId.matches("wikidata:Q[1-9][0-9]{0,14}|osm:(node|way|relation):[1-9][0-9]{0,18}"))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"An exact Wikidata or OpenStreetMap identity is required");
        Gallery hit=cache.get(sourceId); if(hit!=null)return hit;
        if(!requests.tryAcquire())return new Gallery(List.of(),"Photo lookup is busy. Please try again.",true);
        List<DiscoveryImage> images=new ArrayList<>();
        try {
            String id=null;
            if(sourceId.startsWith("wikidata:"))id=sourceId.substring(9);
            else {
                String[] parts=sourceId.split(":");
                JsonNode osm=client.get().uri(URI.create("https://api.openstreetmap.org/api/0.6/"+parts[1]+"/"+parts[2]+".json")).retrieve().body(JsonNode.class);
                JsonNode tags=osm==null?null:osm.path("elements").path(0).path("tags");
                if(tags!=null) {
                    add(images,commons.resolve(tags.path("wikimedia_commons").asText(null)));
                    add(images,commons.resolveUrl(tags.path("image").asText(null)));
                    id=tags.path("wikidata").asText(null);
                    if(id==null && tags.path("wikipedia").asText("").startsWith("en:")) {
                        String title=tags.path("wikipedia").asText().substring(3);
                        if(title.length()<=240) {
                            String encoded=java.net.URLEncoder.encode(title.replace(' ','_'),java.nio.charset.StandardCharsets.UTF_8).replace("+","%20");
                            JsonNode summary=client.get().uri(URI.create("https://en.wikipedia.org/api/rest_v1/page/summary/"+encoded)).retrieve().body(JsonNode.class);
                            if(summary!=null)id=summary.path("wikibase_item").asText(null);
                        }
                    }
                }
            }
            if(id!=null && id.matches("Q[1-9][0-9]{0,14}") && images.size()<2) {
                JsonNode data=client.get().uri(URI.create("https://www.wikidata.org/wiki/Special:EntityData/"+id+".json")).retrieve().body(JsonNode.class);
                JsonNode entity=data==null?null:data.path("entities").path(id);
                int candidates=0;
                if(entity!=null)for(JsonNode claim:entity.path("claims").path("P18")) {
                    if(candidates++>=6)break;
                    if(images.size()>=2)break;
                    if("deprecated".equals(claim.path("rank").asText()))continue;
                    String file=claim.path("mainsnak").path("datavalue").path("value").asText("");
                    if(!file.isBlank() && file.length()<=240)add(images,commons.resolve("File:"+file));
                }
                if(images.size()<2)for(DiscoveryImage photo:commons.depicting(id)) {add(images,photo);if(images.size()>=2)break;}
            }
            Gallery gallery=new Gallery(List.copyOf(images),images.size()>=2?"Two source-linked photographs":"Only "+images.size()+" source-linked photograph(s) available. No substitute images were added.",false);
            cache.put(sourceId,gallery,Instant.now().plus(images.size()>=2?7:1,ChronoUnit.DAYS));return gallery;
        } catch(RuntimeException ex) { return new Gallery(List.copyOf(images),"Photo sources are temporarily unavailable. Please try again.",true); }
        finally {requests.release();}
    }
    static void add(List<DiscoveryImage> images,DiscoveryImage photo) {
        if(photo!=null && images.stream().noneMatch(i->Objects.equals(i.sourcePage(),photo.sourcePage()) || Objects.equals(i.url(),photo.url())))images.add(photo);
    }
    public record Gallery(List<DiscoveryImage> images,String message,boolean retryable) {}
}

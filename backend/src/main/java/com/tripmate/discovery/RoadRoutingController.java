package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.provider.ProviderHttpClientFactory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/routing/drive")
public class RoadRoutingController {
    public record Point(@DecimalMin("-90") @DecimalMax("90") double latitude,@DecimalMin("-180") @DecimalMax("180") double longitude) {}
    public record Request(@NotNull @Size(min=2,max=25) List<@Valid @NotNull Point> points) {}
    public record Leg(double distanceKm,double durationMinutes) {}
    public record Estimate(boolean available,Double distanceKm,Double durationMinutes,List<Leg> legs,List<List<Double>> path,String message) {}
    private final RestClient client;private final String key;
    private final ExpiringCache<String,Estimate> cache=new ExpiringCache<>(128);
    public RoadRoutingController(ProviderHttpClientFactory factory,@Value("${discovery.geoapify.api-key:}") String key){this.client=factory.create(5000);this.key=key==null?"":key.trim();}
    @PostMapping public Estimate estimate(@Valid @RequestBody Request request) {
        if(request.points().stream().anyMatch(p->!Double.isFinite(p.latitude())||!Double.isFinite(p.longitude())))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Invalid route coordinates");
        String points=request.points().stream().map(p->p.latitude()+","+p.longitude()).collect(Collectors.joining("|"));
        var hit=cache.get(points);if(hit!=null)return hit;
        if(key.isEmpty())return unavailable();
        try {
            var uri=UriComponentsBuilder.fromUriString("https://api.geoapify.com/v1/routing").queryParam("waypoints",points).queryParam("mode","drive")
                    .queryParam("units","metric").queryParam("intermediate_waypoint_mode","stopover").queryParam("apiKey",key).build().encode().toUri();
            var json=client.get().uri(uri).retrieve().body(JsonNode.class);
            var feature=json==null?null:json.path("features").path(0);if(feature==null)return unavailable();
            var properties=feature.path("properties");double distance=properties.path("distance").asDouble(-1),seconds=properties.path("time").asDouble(-1);
            var legs=new ArrayList<Leg>();for(var leg:properties.path("legs")) {
                double d=leg.path("distance").asDouble(-1),t=leg.path("time").asDouble(-1);
                if(!valid(d)||!valid(t))return unavailable();legs.add(new Leg(d/1000,t/60));
            }
            if(!valid(distance)||!valid(seconds)||legs.size()!=request.points().size()-1)return unavailable();
            var path=new ArrayList<List<Double>>();
            if("MultiLineString".equals(feature.path("geometry").path("type").asText()))for(var line:feature.path("geometry").path("coordinates"))for(var point:line) {
                double lon=point.path(0).asDouble(Double.NaN),lat=point.path(1).asDouble(Double.NaN);
                if(!Double.isFinite(lon)||!Double.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)return unavailable();
                if(path.size()>=10000)return unavailable();path.add(List.of(lat,lon));
            }
            var estimate=new Estimate(true,distance/1000,seconds/60,List.copyOf(legs),List.copyOf(path),"Geoapify driving estimate; excludes live traffic and time at stops.");
            cache.put(points,estimate,Instant.now().plusSeconds(1800));return estimate;
        } catch(RuntimeException ex) {return unavailable();}
    }
    private static boolean valid(double value){return Double.isFinite(value)&&value>=0;}
    private static Estimate unavailable(){return new Estimate(false,null,null,List.of(),List.of(),"Driving estimate unavailable. Open the route in Maps.");}
}

package com.tripmate.discovery.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tripmate.discovery.*;
import com.tripmate.place.PlaceCategory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/** Key-free, bounded landmark fallback; orchestration invokes it only for sparse inventories. */
@Component
@Order(50)
public class WikidataDiscoveryProvider implements DiscoveryProvider {
    private static final Map<String,DiscoveryCategory> KINDS = Map.ofEntries(
            Map.entry("Q570116",DiscoveryCategory.ATTRACTION),Map.entry("Q33506",DiscoveryCategory.MUSEUM),
            Map.entry("Q44539",DiscoveryCategory.TEMPLE),Map.entry("Q22698",DiscoveryCategory.PARK),
            Map.entry("Q23397",DiscoveryCategory.LAKE),Map.entry("Q34038",DiscoveryCategory.WATERFALL),
            Map.entry("Q8502",DiscoveryCategory.NATURE),Map.entry("Q40080",DiscoveryCategory.BEACH),
            Map.entry("Q4989906",DiscoveryCategory.HISTORICAL),Map.entry("Q23413",DiscoveryCategory.HISTORICAL),
            Map.entry("Q35509",DiscoveryCategory.NATURE),Map.entry("Q839954",DiscoveryCategory.HISTORICAL));
    private static final Pattern ENTITY = Pattern.compile("https?://www\\.wikidata\\.org/entity/(Q[0-9]+)");
    private static final Pattern POINT = Pattern.compile("Point\\(\\s*([-+0-9.eE]+)\\s+([-+0-9.eE]+)\\s*\\)");
    private final RestClient client;
    private final WikimediaEnrichmentService enrichment;
    @org.springframework.beans.factory.annotation.Autowired
    public WikidataDiscoveryProvider(ProviderHttpClientFactory factory, WikimediaEnrichmentService enrichment) {
        this(factory.create(12000),enrichment);
    }
    WikidataDiscoveryProvider(RestClient client, WikimediaEnrichmentService enrichment) { this.client=client; this.enrichment=enrichment; }
    @Override public String name() { return "Wikidata"; }
    @Override public DiscoveryProviderResult discover(DiscoveryProviderRequest request) {
        var kinds=KINDS.entrySet().stream().filter(e -> request.category()==null || e.getValue()==request.category())
                .map(e -> "wd:"+e.getKey()).sorted().toList();
        if(kinds.isEmpty() || !request.destination().isIndia()) return new DiscoveryProviderResult(name(),"",List.of(),List.of());
        String nameClause = request.placeName() == null || request.placeName().isBlank() ? ""
                : "?item rdfs:label ?matchedName . FILTER(CONTAINS(LCASE(STR(?matchedName)), "
                    + sparqlString(request.placeName().trim().toLowerCase(Locale.ROOT)) + "))";
        String query="""
          SELECT DISTINCT ?item ?itemLabel ?location ?distance ?kind WHERE {
            SERVICE wikibase:around {
              ?item wdt:P625 ?location .
              bd:serviceParam wikibase:center "Point(%s %s)"^^geo:wktLiteral ; wikibase:radius "%d" ; wikibase:distance ?distance .
            }
            %s
            VALUES ?kind { %s }
            ?item wdt:P31/wdt:P279* ?kind .
            FILTER NOT EXISTS { ?item wdt:P17 ?country . FILTER(?country != wd:Q668) }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ta" . }
          } ORDER BY ?distance LIMIT 200
          """.formatted(request.destination().longitude().toPlainString(),request.destination().latitude().toPlainString(),request.radiusKm(),nameClause,String.join(" ",kinds));
        var uri=UriComponentsBuilder.fromUriString("https://query.wikidata.org/sparql")
                .queryParam("query",query).queryParam("format","json").build().encode().toUri();
        JsonNode response=client.get().uri(uri).header("Accept","application/sparql-results+json").retrieve().body(JsonNode.class);
        JsonNode rows=response==null?null:response.path("results").path("bindings");
        if(rows==null || !rows.isArray()) throw new IllegalStateException("Unsupported Wikidata response");
        Map<String,DiscoveredPlace> places=new LinkedHashMap<>();int imageBudget=4;
        for(JsonNode row:rows) {
            var entity=ENTITY.matcher(value(row,"item"));var point=POINT.matcher(value(row,"location"));
            var kind=ENTITY.matcher(value(row,"kind"));String label=value(row,"itemLabel").trim();
            if(!entity.matches() || !point.matches() || !kind.matches() || !KINDS.containsKey(kind.group(1)))continue;
            String id=entity.group(1);if(label.isBlank() || label.equals(id) || places.containsKey(id))continue;
            BigDecimal lon,lat;
            try{lon=new BigDecimal(point.group(1));lat=new BigDecimal(point.group(2));}catch(NumberFormatException ex){continue;}
            if(lat.doubleValue()<6 || lat.doubleValue()>38 || lon.doubleValue()<68 || lon.doubleValue()>98)continue;
            double distance=distance(request.destination().latitude().doubleValue(),request.destination().longitude().doubleValue(),lat.doubleValue(),lon.doubleValue());
            if(distance>request.radiusKm()+.2)continue;
            var extra=WikimediaEnrichmentService.Enrichment.empty();
            if(imageBudget-- > 0)try{var e=enrichment.resolve(JsonNodeFactory.instance.objectNode().put("wikidata",id));if(e!=null)extra=e;}catch(RuntimeException ignored){}
            var image=extra.image();
            places.put(id,DiscoveredPlace.builder().externalId("wikidata:"+id).name(label).category(KINDS.get(kind.group(1)))
                    .latitude(lat).longitude(lon).distanceKm(Math.round(distance*10)/10.0).description(extra.description())
                    .saveCategory(PlaceCategory.ATTRACTION).city(request.destination().city()).state(request.destination().state())
                    .sourceName("Wikidata · CC0").sourceUrl("https://www.wikidata.org/wiki/"+id).sourceLastCheckedAt(Instant.now())
                    .confidenceScore(.72).priceStatus(PriceStatus.UNKNOWN).priceType(PriceType.UNKNOWN).imageGallery(extra.gallery())
                    .primaryImageUrl(image==null?null:image.url()).imageSource(image==null?null:image.sourceName())
                    .imageAttribution(image==null?null:image.attribution()).imageLicense(image==null?null:image.license()).imageExact(image!=null && image.exact())
                    .mapUrl("https://www.google.com/maps/dir/?api=1&destination="+lat+","+lon).build());
        }
        return new DiscoveryProviderResult(name(),"Wikidata CC0; Wikimedia Commons photos where individually credited",List.copyOf(places.values()),
                rows.size()>=200?List.of("Wikidata reached its 200-row query limit; this is not a complete destination inventory."):List.of());
    }
    // Encode user input as a SPARQL string literal, never as query syntax.
    private String sparqlString(String value) {
        StringBuilder out = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            if (c == '\\' || c == '"') out.append('\\').append(c);
            else if (c < 32 || c == 127) out.append(String.format("\\u%04x", (int)c));
            else out.append(c);
        }
        return out.append('"').toString();
    }
    private String value(JsonNode row,String key){return row.path(key).path("value").asText("");}
    private double distance(double a,double b,double c,double d){
        double x=Math.sin(Math.toRadians(c-a)/2),y=Math.sin(Math.toRadians(d-b)/2);
        return 6371.0088*2*Math.asin(Math.min(1,Math.sqrt(x*x+Math.cos(Math.toRadians(a))*Math.cos(Math.toRadians(c))*y*y)));
    }
}

package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripmate.discovery.provider.GeocodedDestination;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.*;

/**
 * Suttru's bundled list of up to 30 recommended places for each Indian destination
 * (built from Wikivoyage, Wikidata and a small set of reviewed additions).
 * Loaded once from {@code discovery/recommended-places.json}.
 */
@Service
@Slf4j
public class RecommendedPlacesCatalogue {
    static final String RESOURCE = "discovery/recommended-places.json";

    private volatile Map<String, Destination> byName;
    private volatile List<Destination> all;

    public record Place(String name, String category, String wikidataId, boolean verified, String source, Double latitude, Double longitude) {
        public boolean mapped() { return latitude != null && longitude != null; }
        public boolean activity() { return "A".equals(category); }
    }

    public record Destination(String title, String state, Double latitude, Double longitude, String guideUrl, List<Place> places) {}

    /** The destination's list, matched by name (city, then the first part of the display name) or nearest centre. */
    public Optional<Destination> forDestination(String query, GeocodedDestination destination) {
        if (destination == null || !destination.isIndia()) return Optional.empty();
        load();
        List<String> names = new ArrayList<>();
        if (query != null && !query.isBlank()) names.add(query.split(",")[0].trim());
        names.addAll(candidates(destination));
        for (String candidate : names) {
            Destination hit = byName.get(WikivoyageGuideService.normalize(candidate));
            if (hit != null && near(hit, destination, 40)) return Optional.of(hit);
        }
        // Fall back to the nearest catalogue destination within 8 km (e.g. a neighbourhood search).
        return all.stream().filter(d -> near(d, destination, 8))
                .min(Comparator.comparingDouble(d -> distance(d, destination)));
    }

    private List<String> candidates(GeocodedDestination destination) {
        List<String> names = new ArrayList<>();
        if (destination.city() != null && !destination.city().isBlank()) names.add(destination.city());
        String display = destination.displayName() == null ? "" : destination.displayName();
        for (String part : display.split(",")) if (!part.isBlank()) names.add(part.trim());
        return names;
    }

    private boolean near(Destination d, GeocodedDestination g, double km) {
        return d.latitude() == null || d.longitude() == null || distance(d, g) <= km;
    }

    private double distance(Destination d, GeocodedDestination g) {
        if (d.latitude() == null || d.longitude() == null) return Double.MAX_VALUE;
        return WikivoyageGuideService.distanceKm(d.latitude(), d.longitude(), g.latitude().doubleValue(), g.longitude().doubleValue());
    }

    private static final Set<String> STOP = Set.of("the", "of", "at", "in", "on", "and", "by", "to", "government", "govt",
            "boating", "boat", "house", "ride", "rides", "sunrise", "sunset", "evening", "morning", "tour", "tours", "visit");
    private static final Set<String> GENERIC = Set.of("lake", "fall", "temple", "garden", "park", "church", "museum", "fort", "palace",
            "beach", "dam", "cave", "hill", "peak", "point", "view", "viewpoint", "river", "ashram", "ghat", "market", "bridge", "mandir",
            "road", "complex", "area", "valley", "forest", "island", "statue", "memorial", "tomb", "mosque", "masjid", "monastery",
            "cathedral", "zoo", "national", "sanctuary", "wildlife", "reserve", "mahal", "sagar");
    private static final Map<String, String> SYN = Map.of("gufa", "cave", "spot", "point", "gardens", "garden", "falls", "fall",
            "waterfalls", "fall", "waterfall", "fall", "jumping", "jump", "caves", "cave");

    private static List<String> core(String name, String city) {
        Set<String> cityWords = new HashSet<>(Arrays.asList(WikivoyageGuideService.normalize(city).split(" ")));
        List<String> out = new ArrayList<>();
        for (String w : WikivoyageGuideService.normalize(name).split(" ")) {
            String word = SYN.getOrDefault(w, w.endsWith("ing") && w.length() > 5 ? w.substring(0, w.length() - 3) : w);
            if (word.length() >= 3 && !STOP.contains(word) && !cityWords.contains(word)) out.add(word);
        }
        return out;
    }

    /** True when two names refer to the same place (spelling variants, type words, extra descriptive words). */
    public static boolean sameName(String a, String b, String city) {
        String x = WikivoyageGuideService.normalize(a), y = WikivoyageGuideService.normalize(b);
        if (x.isBlank() || y.isBlank()) return false;
        if (x.equals(y)) return true;
        List<String> ca = core(a, city), cb = core(b, city);
        List<String> small = ca.size() <= cb.size() ? ca : cb, big = small == ca ? cb : ca;
        if (small.isEmpty() || small.stream().allMatch(GENERIC::contains)) return false;
        return new HashSet<>(big).containsAll(small);
    }

    private void load() {
        if (byName != null) return;
        synchronized (this) {
            if (byName != null) return;
            Map<String, Destination> names = new HashMap<>();
            List<Destination> list = new ArrayList<>();
            try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
                JsonNode root = new ObjectMapper().readTree(in);
                for (JsonNode d : root.path("destinations")) {
                    List<Place> places = new ArrayList<>();
                    for (JsonNode p : d.path("places")) {
                        places.add(new Place(p.path("n").asText(), p.path("c").asText("S"), p.hasNonNull("q") ? p.path("q").asText() : null,
                                p.path("v").asInt() == 1, p.path("s").asText("sx"),
                                p.hasNonNull("la") ? p.path("la").asDouble() : null, p.hasNonNull("lo") ? p.path("lo").asDouble() : null));
                    }
                    Destination dest = new Destination(d.path("title").asText(), d.path("state").asText(""),
                            d.hasNonNull("lat") ? d.path("lat").asDouble() : null, d.hasNonNull("lon") ? d.path("lon").asDouble() : null,
                            d.path("guide").asText(""), List.copyOf(places));
                    list.add(dest);
                    String title = dest.title().replaceAll("\\s*\\(.*\\)\\s*$", "");
                    names.putIfAbsent(WikivoyageGuideService.normalize(title), dest);
                    names.putIfAbsent(WikivoyageGuideService.normalize(dest.title()), dest);
                }
            } catch (Exception ex) {
                log.warn("Recommended places catalogue unavailable: {}", ex.getClass().getSimpleName());
            }
            all = List.copyOf(list);
            byName = Map.copyOf(names);
        }
    }
}

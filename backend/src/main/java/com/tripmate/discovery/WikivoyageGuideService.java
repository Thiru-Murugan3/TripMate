package com.tripmate.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.provider.GeocodedDestination;
import com.tripmate.discovery.provider.ProviderHttpClientFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads a destination's Wikivoyage guide (CC BY-SA) to learn which places a travel guide
 * actually recommends. Used to rank main sights first, and to add the guide's own listings.
 * Only text the guide itself contains is used; nothing is inferred or generated.
 */
@Service
@Slf4j
public class WikivoyageGuideService {
    public static final String ATTRIBUTION = "Wikivoyage contributors · CC BY-SA 4.0";
    private static final Pattern LISTING = Pattern.compile("\\{\\{\\s*(see|do|listing)\\s*\\|(.*?)\\}\\}", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern GEO = Pattern.compile("\\{\\{\\s*geo\\s*\\|\\s*([-0-9.]+)\\s*\\|\\s*([-0-9.]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern BOLD = Pattern.compile("'''(.{2,80}?)'''");
    private static final Pattern LINK = Pattern.compile("\\[\\[(?:[^|\\]]*\\|)?([^\\]]{2,80})\\]\\]");
    private static final Pattern ACTIVITY = Pattern.compile(
            "(?i).*\\b(raft|rafting|trek|trekking|hike|hiking|camping|camp|zip ?line|ziplining|paragliding|bungee|kayak|"
                    + "kayaking|boating|safari|cruise|scuba|snorkel|surfing|skiing|climbing|cycling|yoga|aarti|ganga aarti)\\b.*");

    private final RestClient client;
    private final ExpiringCache<String, Guide> cache = new ExpiringCache<>(256);

    @Autowired
    public WikivoyageGuideService(ProviderHttpClientFactory factory) { this(factory.create(5000)); }
    WikivoyageGuideService(RestClient client) { this.client = client; }

    /** Returns the guide for the destination, or {@link Guide#EMPTY} when none can be matched safely. */
    public Guide guide(GeocodedDestination destination) {
        if (destination == null || !destination.isIndia()) return Guide.EMPTY;
        String title = title(destination);
        if (title.isBlank()) return Guide.EMPTY;
        String key = title.toLowerCase(Locale.ROOT);
        Guide hit = cache.get(key);
        if (hit != null) return hit;
        Guide guide;
        try {
            guide = fetch(title, destination);
        } catch (RuntimeException ex) {
            log.debug("Wikivoyage guide unavailable for {}: {}", title, ex.getClass().getSimpleName());
            return Guide.EMPTY; // not cached, so a later search can try again
        }
        cache.put(key, guide, Instant.now().plus(guide == Guide.EMPTY ? 2 : 24, ChronoUnit.HOURS));
        return guide;
    }

    private String title(GeocodedDestination destination) {
        String city = destination.city();
        if (city == null || city.isBlank()) {
            String display = destination.displayName() == null ? "" : destination.displayName();
            city = display.contains(",") ? display.substring(0, display.indexOf(',')) : display;
        }
        return city.trim();
    }

    Guide fetch(String title, GeocodedDestination destination) {
        var uri = UriComponentsBuilder.fromUriString("https://en.wikivoyage.org/w/api.php")
                .queryParam("action", "parse").queryParam("page", title).queryParam("prop", "wikitext")
                .queryParam("redirects", 1).queryParam("format", "json").build().encode().toUri();
        JsonNode response = client.get().uri(uri).retrieve().body(JsonNode.class);
        String text = response == null ? "" : response.path("parse").path("wikitext").path("*").asText("");
        String pageTitle = response == null ? title : response.path("parse").path("title").asText(title);
        return parse(text, pageTitle, destination);
    }

    /** Parses guide wikitext; returns EMPTY unless the guide's own coordinates are near the destination. */
    static Guide parse(String text, String pageTitle, GeocodedDestination destination) {
        if (text == null || text.isBlank()) return Guide.EMPTY;
        Matcher geo = GEO.matcher(text);
        if (!geo.find()) return Guide.EMPTY;
        try {
            double lat = Double.parseDouble(geo.group(1)), lon = Double.parseDouble(geo.group(2));
            if (distanceKm(lat, lon, destination.latitude().doubleValue(), destination.longitude().doubleValue()) > 40) return Guide.EMPTY;
        } catch (NumberFormatException ex) {
            return Guide.EMPTY;
        }
        String see = section(text, "See"), doing = section(text, "Do");
        String pageUrl = "https://en.wikivoyage.org/wiki/" + pageTitle.replace(' ', '_');
        List<Listing> listings = new ArrayList<>();
        Set<String> highlights = new LinkedHashSet<>();
        List<Activity> activities = new ArrayList<>();
        collectListings(see, "see", listings, highlights);
        collectListings(doing, "do", listings, highlights);
        collectHighlights(see, highlights, null);
        collectHighlights(doing, highlights, activities);
        return new Guide(pageUrl, List.copyOf(listings), Set.copyOf(highlights), List.copyOf(activities));
    }

    private static void collectListings(String section, String kind, List<Listing> listings, Set<String> highlights) {
        Matcher m = LISTING.matcher(section);
        while (m.find()) {
            Map<String, String> fields = new HashMap<>();
            for (String part : m.group(2).split("\\|")) {
                int eq = part.indexOf('=');
                if (eq > 0) fields.put(part.substring(0, eq).trim().toLowerCase(Locale.ROOT), part.substring(eq + 1).trim());
            }
            String name = plain(fields.getOrDefault("name", ""));
            if (name.isBlank()) continue;
            boolean isSight = "see".equalsIgnoreCase(kind) || "see".equalsIgnoreCase(fields.getOrDefault("type", ""));
            String content = plain(fields.getOrDefault("content", fields.getOrDefault("description", "")));
            // "Do" listings are often small businesses; keep only real activities.
            if (!isSight && !ACTIVITY.matcher(name).matches()) continue;
            highlights.add(name);
            BigDecimal lat = decimal(fields.get("lat")), lon = decimal(fields.get("long") != null ? fields.get("long") : fields.get("lon"));
            listings.add(new Listing(name, isSight, lat, lon, content.length() > 300 ? content.substring(0, 297).trim() + "…" : content));
        }
    }

    /** Bold or linked names at the start of a bullet are the guide's own highlights. */
    private static void collectHighlights(String section, Set<String> highlights, List<Activity> activities) {
        for (String line : section.split("\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("*")) continue;
            String head = trimmed.substring(0, Math.min(trimmed.length(), 160));
            Matcher bold = BOLD.matcher(head);
            String name = null;
            if (bold.find()) name = plain(bold.group(1));
            else {
                Matcher link = LINK.matcher(head);
                if (link.find() && head.indexOf("[[") < 6) name = plain(link.group(1));
            }
            if (name == null || name.isBlank() || name.length() > 80) continue;
            highlights.add(name);
            if (activities != null && ACTIVITY.matcher(name).matches()) {
                String description = plain(trimmed.replaceFirst("^\\*+", ""));
                activities.add(new Activity(name, description.length() > 300 ? description.substring(0, 297).trim() + "…" : description));
            }
        }
    }

    private static String section(String text, String heading) {
        Matcher start = Pattern.compile("(?m)^==\\s*" + heading + "\\s*==\\s*$").matcher(text);
        if (!start.find()) return "";
        Matcher next = Pattern.compile("(?m)^==[^=].*?==\\s*$").matcher(text);
        int end = next.find(start.end()) ? next.start() : text.length();
        return text.substring(start.end(), end);
    }

    static String plain(String wiki) {
        if (wiki == null) return "";
        return wiki.replaceAll("\\[\\[(?:[^|\\]]*\\|)?([^\\]]*)\\]\\]", "$1")
                .replaceAll("\\{\\{[^{}]*\\}\\}", "")
                .replaceAll("'''?", "")
                .replaceAll("<[^>]+>", "")
                .replaceAll("\\s+", " ")
                .replaceAll("^[\\s–—:-]+|[\\s–—:-]+$", "")
                .trim();
    }

    private static BigDecimal decimal(String value) {
        if (value == null || value.isBlank()) return null;
        try { return new BigDecimal(value.trim()); } catch (NumberFormatException ex) { return null; }
    }

    public static double distanceKm(double a, double b, double c, double d) {
        double x = Math.sin(Math.toRadians(c - a) / 2), y = Math.sin(Math.toRadians(d - b) / 2);
        return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(x * x + Math.cos(Math.toRadians(a)) * Math.cos(Math.toRadians(c)) * y * y)));
    }

    /** Lower-cased, accent-free, letters/digits only; "Laxman" and "Lakshman" are folded together. */
    public static String normalize(String name) {
        if (name == null) return "";
        String n = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        n = n.replace("lakshman", "laxman").replace("bhawan", "bhavan").replace("chaurasi kutia", "beatles ashram");
        return n.replaceAll("[^a-z0-9]+", " ").replaceAll("\\b(the|shri|sri|shree)\\b", " ").replaceAll("\\s+", " ").trim();
    }

    /** True when a place name refers to one of the guide's highlights. */
    public static boolean recommended(String placeName, Set<String> normalizedHighlights) {
        String place = normalize(placeName);
        if (place.length() < 4) return false;
        for (String h : normalizedHighlights) {
            if (h.length() < 4) continue;
            if (place.equals(h)) return true;
            if (h.length() >= 6 && place.length() >= 6 && (place.startsWith(h + " ") || h.startsWith(place + " ")
                    || place.endsWith(" " + h) || h.endsWith(" " + place))) return true;
        }
        return false;
    }

    public record Listing(String name, boolean sight, BigDecimal latitude, BigDecimal longitude, String description) {}
    public record Activity(String name, String description) {}

    public record Guide(String pageUrl, List<Listing> listings, Set<String> highlights, List<Activity> activities) {
        public static final Guide EMPTY = new Guide("", List.of(), Set.of(), List.of());
        public Set<String> normalizedHighlights() {
            Set<String> out = new HashSet<>();
            highlights.forEach(h -> { String n = normalize(h); if (!n.isBlank()) out.add(n); });
            return out;
        }
    }
}

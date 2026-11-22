package com.tripmate.discovery;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Coarse relevance bands for the default ordering (lower comes first).
 * Nothing is removed here; low-value records simply sink below real attractions.
 */
public final class TouristPlacePriority {
    private TouristPlacePriority() {}

    /** Road-sign style records such as "2 | 36" or "17 | 36 Hair pin bend". */
    private static final Pattern MARKER = Pattern.compile("^\\s*\\d+\\s*[|/]\\s*\\d+.*|.*\\bhair\\s?pin\\s?bend\\b.*");
    /** Roads, sports grounds and similar places that are rarely a sightseeing destination. */
    private static final Pattern MINOR = Pattern.compile(
            ".*\\b(road|street|salai|selai|ground|grounds|maidan|maithaanam|stadium|pitch|community hall|mandapam|mandabam)\\b.*");
    /** Statues and busts are real but minor points of interest. */
    private static final Pattern STATUE = Pattern.compile(".*\\b(statue|silai|bust)\\b.*");
    /** One-word generic labels ("Aarti", "Shiva", "Waterfall") carry no place identity. */
    private static final Pattern GENERIC = Pattern.compile(
            "^\\s*(aarti|arti|shiva|blue shiva|ganesha|ganesh|hanuman|temple|mandir|statue|waterfall|viewpoint|view point|"
                    + "beach|lake|garden|park|paintings hall|meditation hall|ghat|shrine)\\s*$");
    /** Minor streams in Indian map data ("... Rao", "... Sot", "... Nadi", "... Nala"). */
    private static final Pattern STREAM = Pattern.compile(".*\\b(rao|sot|nadi|khala|khāla|nala|nallah|gad|gadhera|naala)\\s*$");

    public static int rank(DiscoveredPlace place) {
        String name = place.name() == null ? "" : place.name().toLowerCase(Locale.ROOT);
        if(!place.curated() && place.category()==DiscoveryCategory.ATTRACTION && place.name()!=null
                && place.name().toLowerCase(java.util.Locale.ROOT).matches(".*\\b(school ground|school play ?ground|parade ground|volleyball ground|badminton ground|soccer ground|football ground|cricket ground|army ground)\\b.*")) return 3;
        if (MARKER.matcher(name).matches()) return 4;
        if (MINOR.matcher(name).matches() || GENERIC.matcher(name).matches()) return 3;
        if (place.category() == DiscoveryCategory.RIVER && STREAM.matcher(name).matches()) return 3;
        return switch (place.category()) {
            case FOOD, STAY, SHOPPING, TRANSPORT, NIGHTLIFE, WELLNESS -> 3;
            case RIVER -> 2;
            default -> STATUE.matcher(name).matches() ? 1 : 0;
        };
    }
}

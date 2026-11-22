package com.tripmate.discovery;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import static com.tripmate.discovery.DiscoveryCategory.*;

/**
 * How well a place suits a kind of trip. Higher scores rank first; a few places are hidden
 * for trip types they clearly don't fit (for example bars on family trips).
 * Scoring uses only the place's own category and name, so nothing about a place is invented.
 */
public final class TripTypeAffinity {
    private TripTypeAffinity() {}

    public enum Style { FAMILY, FRIENDS, COUPLE, SOLO, ADVENTURE }

    private record Rules(Map<DiscoveryCategory, Integer> categories, Pattern likes, Pattern dislikes,
                         Set<DiscoveryCategory> hiddenCategories, Pattern hiddenNames) {}

    private static Pattern words(String alternatives) {
        return Pattern.compile(".*\\b(" + alternatives + ")\\b.*");
    }

    private static final Pattern NONE = Pattern.compile("(?!)");

    private static final Map<Style, Rules> RULES = Map.of(
            Style.FAMILY, new Rules(
                    Map.ofEntries(Map.entry(FAMILY, 4), Map.entry(PARK, 3), Map.entry(WILDLIFE, 3), Map.entry(LAKE, 3),
                            Map.entry(MUSEUM, 3), Map.entry(BEACH, 3), Map.entry(ENTERTAINMENT, 3), Map.entry(WATERFALL, 2),
                            Map.entry(VIEWPOINT, 2), Map.entry(TEMPLE, 2), Map.entry(CHURCH, 1), Map.entry(HISTORICAL, 2),
                            Map.entry(NATURE, 2), Map.entry(ATTRACTION, 1)),
                    words("zoo|park|garden|gardens|boat|boating|aquarium|museum|toy train|mountain railway|amusement|"
                            + "water park|planetarium|deer|science|children|kids|picnic|lake"),
                    words("bungee|paragliding|rafting|trek|trekking|hike|summit|cliff"),
                    Set.of(NIGHTLIFE),
                    words("bar|pub|pubs|club|nightclub|lounge|wine|brewery|liquor|casino")),
            Style.FRIENDS, new Rules(
                    Map.ofEntries(Map.entry(ADVENTURE, 4), Map.entry(VIEWPOINT, 3), Map.entry(WATERFALL, 3), Map.entry(NATURE, 3),
                            Map.entry(BEACH, 3), Map.entry(ENTERTAINMENT, 3), Map.entry(NIGHTLIFE, 2), Map.entry(LAKE, 2),
                            Map.entry(FOOD, 1), Map.entry(HISTORICAL, 1), Map.entry(ATTRACTION, 1)),
                    words("trek|trekking|hike|hiking|peak|summit|camp|camping|boating|rafting|zip ?line|paragliding|"
                            + "view ?point|falls|waterfall|cafe|adventure|bike|cycling|kayak|water sports|beach|sunset"),
                    words("playground|children|kids"),
                    Set.of(), NONE),
            Style.COUPLE, new Rules(
                    Map.ofEntries(Map.entry(LAKE, 4), Map.entry(VIEWPOINT, 4), Map.entry(PARK, 3), Map.entry(BEACH, 3),
                            Map.entry(WATERFALL, 3), Map.entry(NATURE, 2), Map.entry(HISTORICAL, 2), Map.entry(TEMPLE, 1),
                            Map.entry(CHURCH, 1), Map.entry(WELLNESS, 2), Map.entry(FOOD, 1), Map.entry(ATTRACTION, 1)),
                    words("lake|garden|gardens|rose|sunset|sunrise|view ?point|boat|boating|honeymoon|valley|"
                            + "palace|tea estate|cafe|spa|romantic|meadow"),
                    words("playground|children|kids|amusement"),
                    Set.of(), NONE),
            Style.SOLO, new Rules(
                    Map.ofEntries(Map.entry(MUSEUM, 4), Map.entry(HISTORICAL, 4), Map.entry(CULTURAL, 3), Map.entry(TEMPLE, 3),
                            Map.entry(VIEWPOINT, 3), Map.entry(NATURE, 3), Map.entry(CHURCH, 2), Map.entry(WATERFALL, 2),
                            Map.entry(LAKE, 2), Map.entry(SHOPPING, 1), Map.entry(FOOD, 1), Map.entry(ATTRACTION, 1)),
                    words("museum|heritage|fort|palace|temple|trek|walk|trail|market|bazaar|cafe|library|gallery|"
                            + "view ?point|monastery|ashram"),
                    words("playground|children|kids|amusement"),
                    Set.of(), NONE),
            Style.ADVENTURE, new Rules(
                    Map.ofEntries(Map.entry(ADVENTURE, 5), Map.entry(WATERFALL, 4), Map.entry(NATURE, 4), Map.entry(VIEWPOINT, 3),
                            Map.entry(WILDLIFE, 3), Map.entry(RIVER, 2), Map.entry(LAKE, 2), Map.entry(BEACH, 2),
                            Map.entry(ATTRACTION, 1)),
                    words("trek|trekking|hike|hiking|peak|summit|camp|camping|rafting|paragliding|zip ?line|climb|"
                            + "climbing|cave|caves|forest|falls|waterfall|reserve|national park|sanctuary|safari|kayak|"
                            + "bungee|off ?road|hill|betta"),
                    words("museum|mall|shopping|market"),
                    Set.of(), NONE)
    );

    /** Parses the trip type sent by the client; null means "no preference". */
    public static Style parse(String value) {
        if (value == null || value.isBlank() || value.equalsIgnoreCase("ALL") || value.equalsIgnoreCase("ANY")) return null;
        try {
            return Style.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported trip type");
        }
    }

    public static int score(DiscoveredPlace place, Style style) {
        if (style == null || place == null) return 0;
        Rules rules = RULES.get(style);
        String name = name(place);
        int score = place.category() == null ? 0 : rules.categories().getOrDefault(place.category(), 0);
        if (rules.likes().matcher(name).matches()) score += 3;
        if (rules.dislikes().matcher(name).matches()) score -= 3;
        return score;
    }

    public static boolean hidden(DiscoveredPlace place, Style style) {
        if (style == null || place == null) return false;
        Rules rules = RULES.get(style);
        return rules.hiddenCategories().contains(place.category()) || rules.hiddenNames().matcher(name(place)).matches();
    }

    private static String name(DiscoveredPlace place) {
        return place.name() == null ? "" : place.name().toLowerCase(Locale.ROOT);
    }
}

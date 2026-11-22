package com.tripmate.discovery.provider;

import com.tripmate.discovery.*;
import com.tripmate.place.PlaceCategory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Adds the sights and activities a destination's Wikivoyage guide recommends.
 * Sights need the guide's own coordinates; guide activities (e.g. white-water rafting) are shown
 * as area activities at the destination centre and say so, instead of inventing a precise location.
 */
@Component
@Order(55)
public class WikivoyageDiscoveryProvider implements DiscoveryProvider {
    /** Popularity given to guide-recommended entries so they lead the default ordering. */
    public static final int RECOMMENDED_POPULARITY = 100;
    private final WikivoyageGuideService guides;

    public WikivoyageDiscoveryProvider(WikivoyageGuideService guides) { this.guides = guides; }

    @Override public String name() { return "Wikivoyage"; }

    @Override public DiscoveryProviderResult discover(DiscoveryProviderRequest request) {
        if (request.placeName() != null && !request.placeName().isBlank())
            return new DiscoveryProviderResult(name(), "", List.of(), List.of());
        var guide = guides.guide(request.destination());
        if (guide.listings().isEmpty() && guide.activities().isEmpty())
            return new DiscoveryProviderResult(name(), "", List.of(), List.of());
        GeocodedDestination destination = request.destination();
        double lat0 = destination.latitude().doubleValue(), lon0 = destination.longitude().doubleValue();
        Instant checked = Instant.now();
        List<DiscoveredPlace> places = new ArrayList<>();

        for (var listing : guide.listings()) {
            if (listing.latitude() == null || listing.longitude() == null) continue;
            double distance = WikivoyageGuideService.distanceKm(lat0, lon0, listing.latitude().doubleValue(), listing.longitude().doubleValue());
            if (distance > request.radiusKm() + .2) continue;
            DiscoveryCategory category = listing.sight() ? categoryFor(listing.name()) : DiscoveryCategory.ADVENTURE;
            if (!DiscoveryCategoryMatching.matches(request.category(), category)) continue;
            places.add(place("wikivoyage:" + slug(guide.pageUrl() + "#" + listing.name()), listing.name(), category,
                    listing.latitude(), listing.longitude(), distance, listing.description(), guide.pageUrl(),
                    listing.sight() ? DiscoveryItemType.PLACE : DiscoveryItemType.ACTIVITY, destination, checked));
        }
        for (var activity : guide.activities()) {
            if (!DiscoveryCategoryMatching.matches(request.category(), DiscoveryCategory.ADVENTURE)) break;
            String area = destination.city() == null || destination.city().isBlank() ? "the area" : destination.city();
            String description = activity.description().isBlank() ? "Recommended activity in " + area + "."
                    : activity.description();
            places.add(place("wikivoyage:" + slug(guide.pageUrl() + "#do-" + activity.name()), activity.name() + " in " + area,
                    DiscoveryCategory.ADVENTURE, destination.latitude(), destination.longitude(), -1,
                    description + " (Area activity; meeting points vary by operator.)", guide.pageUrl(),
                    DiscoveryItemType.ACTIVITY, destination, checked));
        }
        return new DiscoveryProviderResult(name(), WikivoyageGuideService.ATTRIBUTION, places, List.of());
    }

    private DiscoveredPlace place(String id, String name, DiscoveryCategory category, BigDecimal lat, BigDecimal lon,
                                  double distance, String description, String source, DiscoveryItemType itemType,
                                  GeocodedDestination destination, Instant checked) {
        return DiscoveredPlace.builder().externalId(id).name(name).category(category).latitude(lat).longitude(lon)
                .distanceKm(Math.round(distance * 10) / 10.0).description(description.isBlank() ? null : description)
                .shortDescription(description.isBlank() ? null : description).itemType(itemType)
                .saveCategory(itemType == DiscoveryItemType.ACTIVITY ? PlaceCategory.ACTIVITY : PlaceCategory.ATTRACTION)
                .city(destination.city()).state(destination.state())
                .sourceName("Wikivoyage · CC BY-SA").sourceUrl(source).sourceLastCheckedAt(checked)
                .confidenceScore(.8).popularityScore(RECOMMENDED_POPULARITY)
                .priceStatus(PriceStatus.UNKNOWN).priceType(PriceType.UNKNOWN)
                .mapUrl("https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon).build();
    }

    private DiscoveryCategory categoryFor(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.matches(".*\\b(temple|mandir|ashram|math|gurudwara|gurdwara|ghat|niketan|bhavan|bhawan|dargah|mosque|masjid)\\b.*")) return DiscoveryCategory.TEMPLE;
        if (n.matches(".*\\b(church|cathedral)\\b.*")) return DiscoveryCategory.CHURCH;
        if (n.matches(".*\\b(museum|gallery)\\b.*")) return DiscoveryCategory.MUSEUM;
        if (n.matches(".*\\b(fort|palace|tomb|ruins|monument)\\b.*")) return DiscoveryCategory.HISTORICAL;
        if (n.matches(".*\\b(falls|waterfall|waterfalls)\\b.*")) return DiscoveryCategory.WATERFALL;
        if (n.matches(".*\\b(lake)\\b.*")) return DiscoveryCategory.LAKE;
        if (n.matches(".*\\b(beach)\\b.*")) return DiscoveryCategory.BEACH;
        if (n.matches(".*\\b(park|garden|gardens)\\b.*")) return DiscoveryCategory.PARK;
        if (n.matches(".*\\b(view ?point|peak|hill)\\b.*")) return DiscoveryCategory.VIEWPOINT;
        return DiscoveryCategory.ATTRACTION;
    }

    private String slug(String value) {
        return Integer.toHexString(value.toLowerCase(Locale.ROOT).hashCode()) + "-" +
                value.replaceAll(".*#", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}

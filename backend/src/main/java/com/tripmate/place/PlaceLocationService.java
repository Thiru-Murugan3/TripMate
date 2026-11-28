package com.tripmate.place;

import com.tripmate.discovery.RecommendedPlacesCatalogue;
import com.tripmate.discovery.WikivoyageGuideService;
import com.tripmate.discovery.provider.DestinationGeocodingService;
import com.tripmate.discovery.provider.GeocodedDestination;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Finds real coordinates for a saved place that arrived without any (for example a recommended
 * place whose location the catalogue doesn't know). Without this the route map has nothing to
 * connect. Never invents a location: if nothing trustworthy is found the place stays unmapped and
 * the app shows it under "Location needed".
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PlaceLocationService {

    /** A hit further than this from the area is a different place with the same name. */
    static final double MAX_KM_FROM_AREA = 80;
    /** A hit this close to the area centre means the search only found the town, not the place. */
    static final double MIN_KM_FROM_AREA_CENTRE = 0.2;

    public record Location(BigDecimal latitude, BigDecimal longitude) {}

    private final PointOfInterestLookup pointsOfInterest;
    private final DestinationGeocodingService areaGeocoder;

    /** Tries each area in turn (e.g. the place's own city, then the trip destination). */
    public Optional<Location> locate(String name, String... areas) {
        if (name == null || name.isBlank()) return Optional.empty();
        String place = name.trim();
        Set<String> tried = new LinkedHashSet<>();
        for (String raw : areas) {
            if (raw == null || raw.isBlank() || !tried.add(raw.trim().toLowerCase())) continue;
            String area = raw.trim();
            Optional<GeocodedDestination> centre = areaCentre(area);
            for (PointOfInterestLookup.Candidate hit : search(place + ", " + area)) {
                // Must be the place asked for, not a similarly named neighbour or the town itself.
                if (!sameName(hit.name(), place, area)) continue;
                if (centre.isPresent()) {
                    double km = distance(centre.get(), hit);
                    if (km > MAX_KM_FROM_AREA || km < MIN_KM_FROM_AREA_CENTRE) continue;
                }
                return Optional.of(new Location(hit.latitude(), hit.longitude()));
            }
        }
        return Optional.empty();
    }

    private static boolean sameName(String found, String wanted, String area) {
        return found != null && !found.isBlank()
                && (found.trim().equalsIgnoreCase(wanted) || RecommendedPlacesCatalogue.sameName(found, wanted, area));
    }

    private List<PointOfInterestLookup.Candidate> search(String query) {
        try {
            return pointsOfInterest.search(query);
        } catch (RuntimeException ex) {
            // Provider down or slow: leave the place unmapped rather than fail the save.
            log.debug("Place location lookup failed: {}", ex.getClass().getSimpleName());
            return List.of();
        }
    }

    private Optional<GeocodedDestination> areaCentre(String area) {
        try {
            GeocodedDestination result = areaGeocoder.geocode(area);
            return result != null && result.latitude() != null && result.longitude() != null
                    ? Optional.of(result) : Optional.empty();
        } catch (RuntimeException ex) {
            return Optional.empty();
        }
    }

    private static double distance(GeocodedDestination centre, PointOfInterestLookup.Candidate hit) {
        return WikivoyageGuideService.distanceKm(centre.latitude().doubleValue(), centre.longitude().doubleValue(),
                hit.latitude().doubleValue(), hit.longitude().doubleValue());
    }
}

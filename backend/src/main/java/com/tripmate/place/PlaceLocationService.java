package com.tripmate.place;

import com.tripmate.discovery.WikivoyageGuideService;
import com.tripmate.discovery.provider.DestinationGeocodingService;
import com.tripmate.discovery.provider.GeocodedDestination;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
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
    /** A hit this close to the area centre means the geocoder only found the town, not the place. */
    static final double MIN_KM_FROM_AREA_CENTRE = 0.2;

    public record Location(BigDecimal latitude, BigDecimal longitude) {}

    private final DestinationGeocodingService geocoder;

    /** Tries each area in turn (e.g. the place's own city, then the trip destination). */
    public Optional<Location> locate(String name, String... areas) {
        if (name == null || name.isBlank()) return Optional.empty();
        Set<String> tried = new LinkedHashSet<>();
        for (String area : areas) {
            if (area == null || area.isBlank() || !tried.add(area.trim().toLowerCase())) continue;
            Optional<GeocodedDestination> hit = geocode(name.trim() + ", " + area.trim());
            if (hit.isEmpty()) continue;
            Optional<GeocodedDestination> centre = geocode(area.trim());
            if (centre.isPresent()) {
                double km = distance(centre.get(), hit.get());
                if (km > MAX_KM_FROM_AREA || km < MIN_KM_FROM_AREA_CENTRE) continue;
            }
            return Optional.of(new Location(hit.get().latitude(), hit.get().longitude()));
        }
        return Optional.empty();
    }

    private Optional<GeocodedDestination> geocode(String query) {
        try {
            GeocodedDestination result = geocoder.geocode(query);
            return result != null && result.latitude() != null && result.longitude() != null
                    ? Optional.of(result) : Optional.empty();
        } catch (RuntimeException ex) {
            // Not found or providers down: leave the place unmapped rather than fail the save.
            log.debug("Place location lookup failed for a query: {}", ex.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private static double distance(GeocodedDestination a, GeocodedDestination b) {
        return WikivoyageGuideService.distanceKm(a.latitude().doubleValue(), a.longitude().doubleValue(),
                b.latitude().doubleValue(), b.longitude().doubleValue());
    }
}

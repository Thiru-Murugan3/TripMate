package com.tripmate.discovery.provider;

import com.tripmate.discovery.DiscoveredPlace;
import com.tripmate.discovery.curated.CuratedDiscoveryItem;
import com.tripmate.discovery.curated.CuratedDiscoveryMapper;
import com.tripmate.discovery.curated.CuratedDiscoveryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Component
@Order(10)
@RequiredArgsConstructor
public class CuratedDiscoveryProvider implements DiscoveryProvider {
    private final CuratedDiscoveryRepository repository;
    private final CuratedDiscoveryMapper mapper;

    @Override public String name() { return "TripMate verified catalogue"; }

    @Override
    @Transactional(readOnly = true)
    public DiscoveryProviderResult discover(DiscoveryProviderRequest request) {
        List<DiscoveredPlace> places = new ArrayList<>();
        for (CuratedDiscoveryItem item : repository.findByEnabledTrue()) {
            double distance = haversine(request.destination().latitude().doubleValue(),
                    request.destination().longitude().doubleValue(), item.getLatitude().doubleValue(), item.getLongitude().doubleValue());
            if (distance > request.radiusKm() + 0.2) continue;
            if (request.category() != null && item.getCategory() != request.category()) continue;
            places.add(mapper.toDiscoveredPlace(item, distance, openNow(item.getOpeningHours())));
        }
        return new DiscoveryProviderResult(name(), "Sources are attached to every curated listing.", places, List.of());
    }

    private Boolean openNow(String openingHours) {
        if (openingHours == null || openingHours.isBlank()) return null;
        if ("24/7".equalsIgnoreCase(openingHours.trim())) return true;
        // Only evaluate the unambiguous HH:mm-HH:mm form. More complex OSM syntax stays unknown.
        if (!openingHours.matches("\\d{2}:\\d{2}-\\d{2}:\\d{2}")) return null;
        String[] parts = openingHours.split("-");
        LocalTime start = LocalTime.parse(parts[0]);
        LocalTime end = LocalTime.parse(parts[1]);
        LocalDateTime indiaNow = LocalDateTime.now(ZoneId.of("Asia/Kolkata"));
        if (indiaNow.getDayOfWeek() == DayOfWeek.SUNDAY && openingHours.toLowerCase().contains("su off")) return false;
        LocalTime now = indiaNow.toLocalTime();
        return !now.isBefore(start) && !now.isAfter(end);
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}

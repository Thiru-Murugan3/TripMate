package com.tripmate.discovery;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/discovery")
@RequiredArgsConstructor
public class DestinationDiscoveryController {

    private final DestinationDiscoveryService destinationDiscoveryService;

    @GetMapping("/places")
    public ResponseEntity<DestinationDiscoveryResponse> discoverPlaces(
            @RequestParam String destination,
            @RequestParam(defaultValue = "50") int radiusKm,
            @RequestParam(defaultValue = "ALL") String category,
            @RequestParam(required = false) String itemType,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String priceStatus,
            @RequestParam(required = false) String subcategory,
            @RequestParam(required = false) Boolean openNow,
            @RequestParam(required = false) Boolean familyFriendly,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) Integer minDuration,
            @RequestParam(required = false) Integer maxDuration,
            @RequestParam(required = false) Double minRating,
            @RequestParam(defaultValue = "RELEVANCE") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size
    ) {
        return ResponseEntity.ok(
                destinationDiscoveryService.search(destination, radiusKm, new DiscoverySearchFilters(
                        category, subcategory, itemType, minPrice, maxPrice, priceStatus, openNow,
                        familyFriendly, difficulty, minDuration, maxDuration, minRating, sort, page, size
                ))
        );
    }

    @GetMapping("/places/{externalId}")
    public ResponseEntity<DiscoveredPlace> getPlace(@PathVariable String externalId) {
        return ResponseEntity.ok(destinationDiscoveryService.findByExternalId(externalId));
    }

    @GetMapping("/categories")
    public ResponseEntity<Map<String, List<String>>> getCategories() {
        return ResponseEntity.ok(Map.of(
                "categories", Arrays.stream(DiscoveryCategory.values()).map(Enum::name).toList(),
                "itemTypes", Arrays.stream(DiscoveryItemType.values()).map(Enum::name).toList(),
                "priceStatuses", Arrays.stream(PriceStatus.values()).map(Enum::name).toList()
        ));
    }

    @GetMapping("/popular-destinations")
    public ResponseEntity<List<String>> getPopularDestinations() {
        return ResponseEntity.ok(List.of(
                "Chennai, Tamil Nadu",
                "Bengaluru, Karnataka",
                "Kodaikanal, Tamil Nadu",
                "Ooty, Tamil Nadu",
                "Munnar, Kerala",
                "Goa",
                "Jaipur, Rajasthan",
                "Rishikesh, Uttarakhand",
                "Manali, Himachal Pradesh"
        ));
    }

    @GetMapping("/search-suggestions")
    public ResponseEntity<List<DiscoverySuggestion>> getSearchSuggestions(
            @RequestParam("q") String query,
            @RequestParam(defaultValue = "6") int limit
    ) {
        return ResponseEntity.ok(destinationDiscoveryService.suggestions(query, limit));
    }

    @GetMapping("/reverse-geocode")
    public ResponseEntity<DiscoverySuggestion> reverseGeocode(
            @RequestParam BigDecimal latitude,
            @RequestParam BigDecimal longitude
    ) {
        return ResponseEntity.ok(destinationDiscoveryService.reverseGeocode(latitude, longitude));
    }
}

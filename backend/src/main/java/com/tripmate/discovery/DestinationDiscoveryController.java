package com.tripmate.discovery;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/discovery")
@RequiredArgsConstructor
public class DestinationDiscoveryController {

    private final DestinationDiscoveryService destinationDiscoveryService;

    @GetMapping("/places")
    public ResponseEntity<DestinationDiscoveryResponse> discoverPlaces(
            @RequestParam String destination,
            @RequestParam(defaultValue = "25") int radiusKm,
            @RequestParam(defaultValue = "ALL") String category
    ) {
        return ResponseEntity.ok(
                destinationDiscoveryService.search(destination, radiusKm, category)
        );
    }
}

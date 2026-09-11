package com.tripmate.trip;

import com.tripmate.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/trips")
@RequiredArgsConstructor
public class TripController {

    private final TripService tripService;

    @PostMapping
    public ResponseEntity<TripResponse> createTrip(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateTripRequest request
    ) {
        TripResponse response = tripService.createTrip(userPrincipal.getId(), request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping
    public ResponseEntity<List<TripResponse>> getMyTrips(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(tripService.getMyTrips(userPrincipal.getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TripResponse> getTripById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(tripService.getTripById(id, userPrincipal.getId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TripResponse> updateTrip(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateTripRequest request
    ) {
        return ResponseEntity.ok(tripService.updateTrip(id, userPrincipal.getId(), request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteTrip(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        tripService.deleteTrip(id, userPrincipal.getId());

        return ResponseEntity.ok(Map.of("message", "Trip deleted successfully"));
    }
}

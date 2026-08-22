package com.tripmate.place;

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
@RequestMapping("/api/v1/trips/{tripId}/places")
@RequiredArgsConstructor
public class PlaceController {

    private final PlaceService placeService;

    @GetMapping
    public ResponseEntity<List<PlaceResponse>> getPlaces(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                placeService.getPlaces(tripId, userPrincipal.getId())
        );
    }

    @GetMapping("/{placeId}")
    public ResponseEntity<PlaceResponse> getPlaceById(
            @PathVariable Long tripId,
            @PathVariable Long placeId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                placeService.getPlaceById(tripId, placeId, userPrincipal.getId())
        );
    }

    @PostMapping
    public ResponseEntity<PlaceResponse> createPlace(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreatePlaceRequest request
    ) {
        PlaceResponse response = placeService.createPlace(
                tripId, userPrincipal.getId(), request
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @PutMapping("/{placeId}")
    public ResponseEntity<PlaceResponse> updatePlace(
            @PathVariable Long tripId,
            @PathVariable Long placeId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdatePlaceRequest request
    ) {
        return ResponseEntity.ok(
                placeService.updatePlace(tripId, placeId, userPrincipal.getId(), request)
        );
    }

    @DeleteMapping("/{placeId}")
    public ResponseEntity<Map<String, String>> deletePlace(
            @PathVariable Long tripId,
            @PathVariable Long placeId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        placeService.deletePlace(tripId, placeId, userPrincipal.getId());

        return ResponseEntity.ok(Map.of("message", "Place deleted successfully"));
    }
}

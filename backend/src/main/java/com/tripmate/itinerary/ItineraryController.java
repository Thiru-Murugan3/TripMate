package com.tripmate.itinerary;

import com.tripmate.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/itinerary")
@RequiredArgsConstructor
public class ItineraryController {

    private final ItineraryService itineraryService;

    // 1. POST /api/v1/trips/{tripId}/itinerary/days
    @PostMapping("/days")
    public ResponseEntity<ItineraryDayResponse> createDay(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateItineraryDayRequest request
    ) {
        ItineraryDayResponse response = itineraryService.createDay(
                tripId, userPrincipal.getId(), request
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // 2. GET /api/v1/trips/{tripId}/itinerary
    @GetMapping
    public ResponseEntity<TripItineraryResponse> getTripItinerary(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                itineraryService.getTripItinerary(tripId, userPrincipal.getId())
        );
    }

    // 3. PUT /api/v1/trips/{tripId}/itinerary/days/{dayId}
    @PutMapping("/days/{dayId}")
    public ResponseEntity<ItineraryDayResponse> updateDay(
            @PathVariable Long tripId,
            @PathVariable Long dayId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateItineraryDayRequest request
    ) {
        return ResponseEntity.ok(
                itineraryService.updateDay(tripId, dayId, userPrincipal.getId(), request)
        );
    }

    // 4. DELETE /api/v1/trips/{tripId}/itinerary/days/{dayId}
    @DeleteMapping("/days/{dayId}")
    public ResponseEntity<Map<String, String>> deleteDay(
            @PathVariable Long tripId,
            @PathVariable Long dayId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        itineraryService.deleteDay(tripId, dayId, userPrincipal.getId());

        return ResponseEntity.ok(Map.of("message", "Itinerary day deleted successfully"));
    }

    // 5. POST /api/v1/trips/{tripId}/itinerary/days/{dayId}/items
    @PostMapping("/days/{dayId}/items")
    public ResponseEntity<ItineraryItemResponse> createItem(
            @PathVariable Long tripId,
            @PathVariable Long dayId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateItineraryItemRequest request
    ) {
        ItineraryItemResponse response = itineraryService.createItem(
                tripId, dayId, userPrincipal.getId(), request
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // 6. PUT /api/v1/trips/{tripId}/itinerary/items/{itemId}
    @PutMapping("/items/{itemId}")
    public ResponseEntity<ItineraryItemResponse> updateItem(
            @PathVariable Long tripId,
            @PathVariable Long itemId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateItineraryItemRequest request
    ) {
        return ResponseEntity.ok(
                itineraryService.updateItem(tripId, itemId, userPrincipal.getId(), request)
        );
    }

    // 7. DELETE /api/v1/trips/{tripId}/itinerary/items/{itemId}
    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Map<String, String>> deleteItem(
            @PathVariable Long tripId,
            @PathVariable Long itemId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        itineraryService.deleteItem(tripId, itemId, userPrincipal.getId());

        return ResponseEntity.ok(Map.of("message", "Itinerary item deleted successfully"));
    }

    // 8. PUT /api/v1/trips/{tripId}/itinerary/reorder
    @PutMapping("/reorder")
    public ResponseEntity<TripItineraryResponse> reorderItinerary(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody ReorderItineraryRequest request
    ) {
        return ResponseEntity.ok(
                itineraryService.reorderItinerary(tripId, userPrincipal.getId(), request)
        );
    }
}

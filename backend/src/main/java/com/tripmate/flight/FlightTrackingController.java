package com.tripmate.flight;

import com.tripmate.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/v1/trips/{tripId}/flights")
public class FlightTrackingController {
    private final FlightTrackingService service;
    @GetMapping public Map<String,Object> list(@PathVariable Long tripId, @AuthenticationPrincipal UserPrincipal user) {
        return Map.of("available", service.available(), "flights", service.list(tripId,user.getId()));
    }
    @PutMapping("/{bookingId}") public FlightTrackingResponse configure(@PathVariable Long tripId,
            @PathVariable Long bookingId, @AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody FlightSetupRequest request) {
        return service.configure(tripId,bookingId,user.getId(),request);
    }
    @PutMapping("/{bookingId}/subscription") public FlightTrackingResponse subscribe(@PathVariable Long tripId,
            @PathVariable Long bookingId, @AuthenticationPrincipal UserPrincipal user, @RequestBody Preference request) {
        return service.subscribe(tripId,bookingId,user.getId(),request.enabled());
    }
    public record Preference(boolean enabled) {}
}

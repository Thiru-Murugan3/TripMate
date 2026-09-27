package com.tripmate.weather;

import com.tripmate.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/weather")
@RequiredArgsConstructor
public class TripWeatherController {

    private final TripWeatherService tripWeatherService;

    @GetMapping
    public ResponseEntity<TripWeatherResponse> getForecast(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(tripWeatherService.getForecast(tripId, userPrincipal.getId()));
    }
}

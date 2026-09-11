package com.tripmate.dashboard;

import com.tripmate.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/dashboard")
@RequiredArgsConstructor
public class TripDashboardController {

    private final TripDashboardService tripDashboardService;

    // GET /api/v1/trips/{tripId}/dashboard
    @GetMapping
    public ResponseEntity<TripDashboardResponse> getDashboard(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                tripDashboardService.getDashboard(tripId, userPrincipal.getId())
        );
    }
}

package com.tripmate.timeline;

import com.tripmate.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/timeline")
@RequiredArgsConstructor
public class TimelineController {

    private final TimelineService timelineService;

    @GetMapping
    public ResponseEntity<TripTimelineResponse> getTripTimeline(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(timelineService.getTripTimeline(tripId, principal.getId()));
    }
}

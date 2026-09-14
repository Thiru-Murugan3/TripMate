package com.tripmate.booking;

import com.tripmate.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/bookings")
@RequiredArgsConstructor
public class BookingMarketplaceController {

    private final BookingMarketplaceService bookingMarketplaceService;

    @PostMapping("/search")
    public ResponseEntity<BookingSearchResponse> search(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody SearchBookingRequest request
    ) {
        return ResponseEntity.ok(
                bookingMarketplaceService.search(tripId, userPrincipal.getId(), request)
        );
    }

    @PostMapping("/book-now")
    public ResponseEntity<BookNowResponse> bookNow(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody BookNowRequest request
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(bookingMarketplaceService.bookNow(tripId, userPrincipal.getId(), request));
    }
}

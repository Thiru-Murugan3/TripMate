package com.tripmate.booking;

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
@RequestMapping("/api/v1/trips/{tripId}/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    // 1. GET /api/v1/trips/{tripId}/bookings
    @GetMapping
    public ResponseEntity<List<BookingResponse>> getBookings(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                bookingService.getBookings(tripId, userPrincipal.getId())
        );
    }

    // 2. GET /api/v1/trips/{tripId}/bookings/{bookingId}
    @GetMapping("/{bookingId}")
    public ResponseEntity<BookingResponse> getBookingById(
            @PathVariable Long tripId,
            @PathVariable Long bookingId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                bookingService.getBookingById(tripId, bookingId, userPrincipal.getId())
        );
    }

    // 3. POST /api/v1/trips/{tripId}/bookings
    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateBookingRequest request
    ) {
        BookingResponse response = bookingService.createBooking(
                tripId, userPrincipal.getId(), request
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // 4. PUT /api/v1/trips/{tripId}/bookings/{bookingId}
    @PutMapping("/{bookingId}")
    public ResponseEntity<BookingResponse> updateBooking(
            @PathVariable Long tripId,
            @PathVariable Long bookingId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateBookingRequest request
    ) {
        return ResponseEntity.ok(
                bookingService.updateBooking(tripId, bookingId, userPrincipal.getId(), request)
        );
    }

    // 5. PATCH /api/v1/trips/{tripId}/bookings/{bookingId}/cancel
    @PatchMapping("/{bookingId}/cancel")
    public ResponseEntity<CancelBookingResponse> cancelBooking(
            @PathVariable Long tripId,
            @PathVariable Long bookingId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CancelBookingRequest request
    ) {
        return ResponseEntity.ok(
                bookingService.cancelBooking(
                        tripId,
                        bookingId,
                        userPrincipal.getId(),
                        request
                )
        );
    }

    // 6. DELETE /api/v1/trips/{tripId}/bookings/{bookingId}
    @DeleteMapping("/{bookingId}")
    public ResponseEntity<Map<String, String>> deleteBooking(
            @PathVariable Long tripId,
            @PathVariable Long bookingId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        bookingService.deleteBooking(tripId, bookingId, userPrincipal.getId());

        return ResponseEntity.ok(Map.of("message", "Booking deleted successfully"));
    }
}

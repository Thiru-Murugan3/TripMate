package com.tripmate.booking.importer;

import com.tripmate.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/bookings/import")
@RequiredArgsConstructor
public class BookingImportController {
    private final BookingImportService bookingImportService;

    private final com.tripmate.booking.BookingService bookingService;

    @PostMapping("/confirm")
    public ResponseEntity<com.tripmate.booking.BookingResponse> confirm(
            @org.springframework.web.bind.annotation.PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal principal,
            @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody
            com.tripmate.booking.CreateBookingRequest request) {
        return ResponseEntity.ok(bookingService.createImportedBooking(tripId, principal.getId(), request));
    }

    @PostMapping(value = "/ocr", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BookingImportDraft> importBooking(
            @org.springframework.web.bind.annotation.PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(bookingImportService.importFile(tripId, principal.getId(), file));
    }
}

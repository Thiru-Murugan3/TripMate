package com.tripmate.booking.email;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class ReservationEmailImportController {

    private final ReservationEmailImportService reservationEmailImportService;

    @GetMapping("/api/v1/reservation-imports/address")
    public ResponseEntity<ReservationImportAddressResponse> address(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(reservationEmailImportService.getAddress(principal.getId()));
    }

    @GetMapping("/api/v1/reservation-imports")
    public ResponseEntity<List<ReservationEmailImportResponse>> imports(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(reservationEmailImportService.listImports(principal.getId()));
    }

    @PatchMapping("/api/v1/reservation-imports/{importId}/complete")
    public ResponseEntity<ReservationEmailImportResponse> complete(
            @PathVariable Long importId,
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CompleteReservationImportRequest request
    ) {
        return ResponseEntity.ok(reservationEmailImportService.complete(importId, principal.getId(), request));
    }

    @DeleteMapping("/api/v1/reservation-imports/{importId}")
    public ResponseEntity<ReservationEmailImportResponse> dismiss(
            @PathVariable Long importId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(reservationEmailImportService.dismiss(importId, principal.getId()));
    }

    @PostMapping("/api/v1/webhooks/brevo/inbound/{secret}")
    public ResponseEntity<Map<String, Integer>> receiveBrevoWebhook(
            @PathVariable String secret,
            @RequestBody JsonNode payload
    ) {
        int accepted = reservationEmailImportService.receiveBrevoWebhook(secret, payload);
        return ResponseEntity.ok(Map.of("accepted", accepted));
    }
}

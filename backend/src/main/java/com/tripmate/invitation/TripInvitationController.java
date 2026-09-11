package com.tripmate.invitation;

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
@RequiredArgsConstructor
public class TripInvitationController {

    private final TripInvitationService invitationService;

    // 1. POST /api/v1/trips/{tripId}/invitations
    @PostMapping("/api/v1/trips/{tripId}/invitations")
    public ResponseEntity<InvitationResponse> createInvitation(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateInvitationRequest request
    ) {
        InvitationResponse response = invitationService.createInvitation(tripId, userPrincipal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 2. GET /api/v1/trips/{tripId}/invitations
    @GetMapping("/api/v1/trips/{tripId}/invitations")
    public ResponseEntity<List<InvitationResponse>> getTripInvitations(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(invitationService.getTripInvitations(tripId, userPrincipal.getId()));
    }

    // 3. DELETE /api/v1/trips/{tripId}/invitations/{invitationId}
    @DeleteMapping("/api/v1/trips/{tripId}/invitations/{invitationId}")
    public ResponseEntity<Map<String, String>> cancelInvitation(
            @PathVariable Long tripId,
            @PathVariable Long invitationId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        invitationService.cancelInvitation(tripId, invitationId, userPrincipal.getId());
        return ResponseEntity.ok(Map.of("message", "Invitation cancelled successfully"));
    }

    // 4. GET /api/v1/invitations/my
    @GetMapping("/api/v1/invitations/my")
    public ResponseEntity<List<InvitationResponse>> getMyInvitations(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(invitationService.getMyInvitations(userPrincipal.getId()));
    }

    // 5. POST /api/v1/invitations/{invitationId}/accept
    @PostMapping("/api/v1/invitations/{invitationId}/accept")
    public ResponseEntity<InvitationResponse> acceptInvitation(
            @PathVariable Long invitationId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(invitationService.acceptInvitation(invitationId, userPrincipal.getId()));
    }

    // 6. POST /api/v1/invitations/{invitationId}/reject
    @PostMapping("/api/v1/invitations/{invitationId}/reject")
    public ResponseEntity<InvitationResponse> rejectInvitation(
            @PathVariable Long invitationId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(invitationService.rejectInvitation(invitationId, userPrincipal.getId()));
    }

    // 7. GET /api/v1/invitations/token/{token}
    @GetMapping("/api/v1/invitations/token/{token}")
    public ResponseEntity<InvitationResponse> getInvitationByToken(
            @PathVariable String token
    ) {
        return ResponseEntity.ok(invitationService.getInvitationByToken(token));
    }

    // 8. POST /api/v1/invitations/token/{token}/accept
    @PostMapping("/api/v1/invitations/token/{token}/accept")
    public ResponseEntity<InvitationResponse> acceptInvitationByToken(
            @PathVariable String token,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(invitationService.acceptInvitationByToken(token, userPrincipal.getId()));
    }
}

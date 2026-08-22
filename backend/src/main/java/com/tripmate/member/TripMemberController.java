package com.tripmate.member;

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
@RequestMapping("/api/v1/trips/{tripId}/members")
@RequiredArgsConstructor
public class TripMemberController {

    private final TripMemberService tripMemberService;

    @GetMapping
    public ResponseEntity<List<TripMemberResponse>> getTripMembers(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                tripMemberService.getTripMembers(tripId, userPrincipal.getId())
        );
    }

    @PostMapping
    public ResponseEntity<TripMemberResponse> addMember(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody AddMemberRequest request
    ) {
        TripMemberResponse response = tripMemberService.addMember(
                tripId, userPrincipal.getId(), request
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @PatchMapping("/{memberId}")
    public ResponseEntity<TripMemberResponse> updateMemberRole(
            @PathVariable Long tripId,
            @PathVariable Long memberId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateMemberRoleRequest request
    ) {
        return ResponseEntity.ok(
                tripMemberService.updateMemberRole(tripId, memberId, userPrincipal.getId(), request)
        );
    }

    @DeleteMapping("/{memberId}")
    public ResponseEntity<Map<String, String>> removeMember(
            @PathVariable Long tripId,
            @PathVariable Long memberId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        tripMemberService.removeMember(tripId, memberId, userPrincipal.getId());

        return ResponseEntity.ok(Map.of("message", "Member removed from trip successfully"));
    }
}

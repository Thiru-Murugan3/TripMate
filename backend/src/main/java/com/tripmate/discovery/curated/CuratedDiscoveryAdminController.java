package com.tripmate.discovery.curated;

import com.tripmate.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/discovery")
@RequiredArgsConstructor
public class CuratedDiscoveryAdminController {
    private final CuratedDiscoveryAdminService service;

    @GetMapping
    public List<AdminDiscoveryItemResponse> list(
            @RequestParam(required = false) Boolean missingPrice,
            @RequestParam(required = false) Boolean missingImage,
            @RequestParam(required = false) Boolean conflictsOnly
    ) {
        return service.findAll(missingPrice, missingImage, conflictsOnly);
    }

    @PostMapping
    public ResponseEntity<AdminDiscoveryItemResponse> create(
            @Valid @RequestBody UpsertDiscoveryItemRequest request,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request, admin.getId()));
    }

    @PutMapping("/{id}")
    public AdminDiscoveryItemResponse update(
            @PathVariable Long id,
            @Valid @RequestBody UpsertDiscoveryItemRequest request,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        return service.update(id, request, admin.getId());
    }

    @PatchMapping("/{id}/verify")
    public AdminDiscoveryItemResponse verify(
            @PathVariable Long id,
            @Valid @RequestBody VerifyDiscoveryItemRequest request,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        return service.verify(id, request, admin.getId());
    }

    @PatchMapping("/{id}/enabled")
    public AdminDiscoveryItemResponse setEnabled(
            @PathVariable Long id,
            @RequestParam boolean enabled,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        return service.setEnabled(id, enabled, admin.getId());
    }
}

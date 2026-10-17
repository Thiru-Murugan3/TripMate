package com.tripmate.discovery.google;

import com.tripmate.security.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/discovery/top-places")
@RequiredArgsConstructor
public class GoogleTopPlacesController {
    public record Request(@NotBlank @Size(min=2,max=180) String destination) {}
    private final GoogleTopPlacesService service;
    @PostMapping
    public ResponseEntity<GoogleTopPlacesService.Result> search(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody Request request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Pragma","no-cache")
                .body(service.search(principal==null?null:principal.getId(),request.destination()));
    }
}

package com.tripmate.discovery.ai;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/discovery/place-illustrations")
@RequiredArgsConstructor
public class AiPlaceIllustrationController {
    private final AiPlaceIllustrationService illustrations;

    /** Whether the feature is switched on, so the UI can skip requests when it is off. */
    @GetMapping("/status")
    public Map<String, Boolean> status() {
        return Map.of("enabled", illustrations.enabled());
    }

    /** Returns (creating once if needed) the labelled illustration for a recently searched place. */
    @PostMapping
    public AiPlaceIllustrationService.Illustration create(@RequestBody Map<String, String> body) {
        return illustrations.illustrationFor(body == null ? null : body.get("externalId"));
    }

    /** Public image bytes: generated artwork only, addressed by an unguessable hash name. */
    @GetMapping("/image/{fileName}")
    public ResponseEntity<byte[]> image(@PathVariable String fileName) throws java.io.IOException {
        Resource resource = illustrations.image(fileName);
        byte[] bytes;
        try (var in = resource.getInputStream()) { bytes = in.readAllBytes(); }
        MediaType type = AiPlaceIllustrationService.imageType(bytes);
        if (type == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .contentType(type)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                .body(bytes);
    }
}

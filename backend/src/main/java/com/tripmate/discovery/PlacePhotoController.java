package com.tripmate.discovery;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/discovery/place-photos")
@RequiredArgsConstructor
public class PlacePhotoController {
    private final PlacePhotoService photos;
    @GetMapping public PlacePhotoService.Gallery photos(@RequestParam String sourceId) { return photos.photos(sourceId); }
}

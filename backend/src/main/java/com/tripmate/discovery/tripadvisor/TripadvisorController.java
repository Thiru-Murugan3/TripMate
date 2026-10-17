package com.tripmate.discovery.tripadvisor;

import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/discovery/tripadvisor")
@RequiredArgsConstructor
public class TripadvisorController {
    private final TripadvisorService service;
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() { return live(Map.of("available", service.available(), "apiMode", service.apiMode(), "setupCode", service.setupCode())); }
    @GetMapping("/search")
    public ResponseEntity<List<TripadvisorService.Location>> search(@RequestParam String query,
            @RequestParam(defaultValue = "attractions") String category) { return live(service.search(query, category)); }
    @GetMapping("/search-page")
    public ResponseEntity<TripadvisorService.SearchPage> searchPage(@RequestParam String query,
            @RequestParam(defaultValue = "attractions") String category,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "4") int size,
            @RequestParam(defaultValue = "COMBINED") String searchType) {
        return live(service.searchPage(query, category, page, size, searchType));
    }
    @GetMapping("/locations/{id}")
    public ResponseEntity<TripadvisorService.Details> details(@PathVariable String id) { return live(service.details(id)); }
    @GetMapping("/locations/{id}/photos")
    public ResponseEntity<List<TripadvisorService.Photo>> photos(@PathVariable String id) { return live(service.photos(id)); }
    private <T> ResponseEntity<T> live(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header(HttpHeaders.PRAGMA, "no-cache").body(body);
    }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> unavailable(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).cacheControl(CacheControl.noStore())
                .body(Map.of("message", ex.getReason() == null ? "Tripadvisor unavailable" : ex.getReason(),
                        "code", ex instanceof TripadvisorFailure failure ? failure.code()
                                : ex.getStatusCode().value() == 429 ? "USAGE_LIMIT" : "REQUEST_FAILED"));
    }
}

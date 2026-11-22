package com.tripmate.flight;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.data.domain.PageRequest;
import java.time.Instant;

@Configuration @EnableScheduling @RequiredArgsConstructor @Slf4j
@ConditionalOnProperty(name="flight-alerts.enabled", havingValue="true")
public class FlightPollingJob {
    private final FlightTrackingRepository repository;
    private final FlightTrackingService service;
    @Scheduled(fixedDelayString="${flight-alerts.scan-delay-ms:60000}", initialDelay=30000)
    public void poll() {
        if (!service.available()) return;
        for (Long id : repository.due(Instant.now(), PageRequest.of(0, 5))) {
            try { service.poll(id); }
            catch (Exception e) { log.warn("Flight check failed for booking {} ({})", id, e.getClass().getSimpleName()); }
        }
    }
}

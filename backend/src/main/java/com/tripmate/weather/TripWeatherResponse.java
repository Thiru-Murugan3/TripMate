package com.tripmate.weather;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record TripWeatherResponse(
        String destination,
        String resolvedLocation,
        Double latitude,
        Double longitude,
        Instant generatedAt,
        boolean available,
        String message,
        List<WeatherDay> days
) {
    public record WeatherDay(
            LocalDate date,
            int weatherCode,
            String condition,
            String icon,
            double minimumTemperatureCelsius,
            double maximumTemperatureCelsius,
            int precipitationProbability
    ) {}
}

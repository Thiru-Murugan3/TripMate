package com.tripmate.weather;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.trip.TripResponse;
import com.tripmate.trip.TripService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TripWeatherService {

    private final TripService tripService;
    private final RestClient restClient = RestClient.create();
    private final Clock clock = Clock.systemUTC();

    @Value("${weather.geocoding-url:https://geocoding-api.open-meteo.com/v1/search}")
    private String geocodingUrl;

    @Value("${weather.forecast-url:https://api.open-meteo.com/v1/forecast}")
    private String forecastUrl;

    public TripWeatherResponse getForecast(Long tripId, Long userId) {
        TripResponse trip = tripService.getTripById(tripId, userId);
        Instant generatedAt = Instant.now(clock);
        LocalDate today = LocalDate.now(clock);

        if (trip.endDate().isBefore(today)) {
            return unavailable(trip.destination(), generatedAt,
                    "This trip has ended. Forecasts are only available for upcoming travel.");
        }
        if (trip.startDate().isAfter(today.plusDays(15))) {
            return unavailable(trip.destination(), generatedAt,
                    "Weather becomes available 16 days before your trip starts.");
        }

        try {
            JsonNode geocoding = restClient.get()
                    .uri(UriComponentsBuilder.fromUriString(geocodingUrl)
                            .queryParam("name", trip.destination())
                            .queryParam("count", 1)
                            .queryParam("language", "en")
                            .queryParam("format", "json").build().encode().toUri())
                    .retrieve()
                    .body(JsonNode.class);

            JsonNode location = geocoding == null ? null : geocoding.path("results").path(0);
            if (location == null || location.isMissingNode()) {
                return unavailable(trip.destination(), generatedAt,
                        "We could not locate this destination for a weather forecast.");
            }

            double latitude = location.path("latitude").asDouble();
            double longitude = location.path("longitude").asDouble();
            String resolvedLocation = location.path("name").asText(trip.destination());
            String country = location.path("country").asText("");
            if (!country.isBlank()) resolvedLocation += ", " + country;

            JsonNode forecast = restClient.get()
                    .uri(UriComponentsBuilder.fromUriString(forecastUrl)
                            .queryParam("latitude", latitude)
                            .queryParam("longitude", longitude)
                            .queryParam("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max")
                            .queryParam("timezone", "auto")
                            .queryParam("forecast_days", 16).build().encode().toUri())
                    .retrieve()
                    .body(JsonNode.class);

            List<TripWeatherResponse.WeatherDay> days = mapDays(forecast, trip.startDate(), trip.endDate(), today);
            if (days.isEmpty()) {
                return new TripWeatherResponse(trip.destination(), resolvedLocation, latitude, longitude,
                        generatedAt, false, "No forecast days overlap this trip yet.", List.of());
            }
            return new TripWeatherResponse(trip.destination(), resolvedLocation, latitude, longitude,
                    generatedAt, true, "Forecast supplied by Open-Meteo and may change.", days);
        } catch (RuntimeException exception) {
            log.warn("Weather forecast unavailable for trip {}: {}", tripId, exception.getMessage());
            return unavailable(trip.destination(), generatedAt,
                    "Live weather is temporarily unavailable. Please try again shortly.");
        }
    }

    private List<TripWeatherResponse.WeatherDay> mapDays(
            JsonNode forecast, LocalDate tripStart, LocalDate tripEnd, LocalDate today
    ) {
        JsonNode daily = forecast == null ? null : forecast.path("daily");
        if (daily == null || daily.isMissingNode()) return List.of();
        JsonNode dates = daily.path("time");
        List<TripWeatherResponse.WeatherDay> result = new ArrayList<>();
        LocalDate effectiveStart = tripStart.isBefore(today) ? today : tripStart;
        for (int index = 0; index < dates.size(); index++) {
            LocalDate date = LocalDate.parse(dates.path(index).asText());
            if (date.isBefore(effectiveStart) || date.isAfter(tripEnd)) continue;
            int code = daily.path("weather_code").path(index).asInt();
            result.add(new TripWeatherResponse.WeatherDay(
                    date,
                    code,
                    condition(code),
                    icon(code),
                    daily.path("temperature_2m_min").path(index).asDouble(),
                    daily.path("temperature_2m_max").path(index).asDouble(),
                    daily.path("precipitation_probability_max").path(index).asInt()
            ));
        }
        return result;
    }

    private TripWeatherResponse unavailable(String destination, Instant generatedAt, String message) {
        return new TripWeatherResponse(destination, destination, null, null, generatedAt, false, message, List.of());
    }

    private String condition(int code) {
        if (code == 0) return "Clear sky";
        if (code <= 3) return "Partly cloudy";
        if (code == 45 || code == 48) return "Foggy";
        if (code <= 57) return "Drizzle";
        if (code <= 67) return "Rain";
        if (code <= 77) return "Snow";
        if (code <= 82) return "Rain showers";
        if (code <= 86) return "Snow showers";
        return "Thunderstorms";
    }

    private String icon(int code) {
        if (code == 0) return "sunny";
        if (code <= 3) return "partly_cloudy_day";
        if (code == 45 || code == 48) return "foggy";
        if (code <= 67 || (code >= 80 && code <= 82)) return "rainy";
        if (code <= 77 || (code >= 85 && code <= 86)) return "weather_snowy";
        return "thunderstorm";
    }
}

package com.tripmate.weather;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.trip.TripResponse;
import com.tripmate.trip.TripService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class TripWeatherService {

    private static final int MAX_ATTEMPTS = 3;
    private static final Duration FRESH_CACHE_AGE = Duration.ofMinutes(30);
    private static final Duration STALE_CACHE_AGE = Duration.ofHours(6);

    private final TripService tripService;
    private final RestClient restClient;
    private final Clock clock = Clock.systemUTC();
    private final Map<ForecastCacheKey, CachedForecast> forecastCache = new ConcurrentHashMap<>();

    @Value("${weather.geocoding-url:https://geocoding-api.open-meteo.com/v1/search}")
    private String geocodingUrl;

    @Value("${weather.forecast-url:https://api.open-meteo.com/v1/forecast}")
    private String forecastUrl;

    public TripWeatherService(TripService tripService, RestClient.Builder restClientBuilder) {
        this.tripService = tripService;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(8));
        requestFactory.setReadTimeout(Duration.ofSeconds(15));

        this.restClient = restClientBuilder
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.USER_AGENT,
                        "TripMate/1.0 (+https://github.com/Thiru-Murugan3/TripMate)")
                .build();
    }

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

        ForecastCacheKey cacheKey = new ForecastCacheKey(
                tripId, trip.destination(), trip.startDate(), trip.endDate());
        CachedForecast cached = forecastCache.get(cacheKey);
        if (isUsable(cached, generatedAt, FRESH_CACHE_AGE)) {
            return cached.response();
        }

        try {
            URI geocodingUri = UriComponentsBuilder.fromUriString(geocodingUrl)
                    .queryParam("name", trip.destination())
                    .queryParam("count", 1)
                    .queryParam("language", "en")
                    .queryParam("format", "json").build().encode().toUri();
            JsonNode geocoding = fetchJson(geocodingUri, "destination geocoding");

            JsonNode location = geocoding.path("results").path(0);
            if (location.isMissingNode()) {
                return unavailable(trip.destination(), generatedAt,
                        "We could not locate this destination for a weather forecast.");
            }

            double latitude = location.path("latitude").asDouble();
            double longitude = location.path("longitude").asDouble();
            String resolvedLocation = location.path("name").asText(trip.destination());
            String country = location.path("country").asText("");
            if (!country.isBlank()) resolvedLocation += ", " + country;

            URI forecastUri = UriComponentsBuilder.fromUriString(forecastUrl)
                    .queryParam("latitude", latitude)
                    .queryParam("longitude", longitude)
                    .queryParam("daily",
                            "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max")
                    .queryParam("timezone", "auto")
                    .queryParam("forecast_days", 16).build().encode().toUri();
            JsonNode forecast = fetchJson(forecastUri, "weather forecast");

            List<TripWeatherResponse.WeatherDay> days =
                    mapDays(forecast, trip.startDate(), trip.endDate(), today);
            if (days.isEmpty()) {
                return new TripWeatherResponse(trip.destination(), resolvedLocation, latitude, longitude,
                        generatedAt, false, "No forecast days overlap this trip yet.", List.of());
            }

            TripWeatherResponse response = new TripWeatherResponse(
                    trip.destination(), resolvedLocation, latitude, longitude,
                    generatedAt, true, "Forecast supplied by Open-Meteo and may change.", days);
            forecastCache.put(cacheKey, new CachedForecast(generatedAt, response));
            return response;
        } catch (RuntimeException exception) {
            log.warn("Weather forecast unavailable for trip {} after {} attempts: {}",
                    tripId, MAX_ATTEMPTS, exception.getMessage());

            if (isUsable(cached, generatedAt, STALE_CACHE_AGE)) {
                TripWeatherResponse previous = cached.response();
                return new TripWeatherResponse(
                        previous.destination(),
                        previous.resolvedLocation(),
                        previous.latitude(),
                        previous.longitude(),
                        previous.generatedAt(),
                        true,
                        "Showing the latest cached forecast while the live weather service recovers.",
                        previous.days()
                );
            }

            return unavailable(trip.destination(), generatedAt,
                    "Live weather is temporarily unavailable. Please try again shortly.");
        }
    }

    private JsonNode fetchJson(URI uri, String operation) {
        RuntimeException lastFailure = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                JsonNode response = restClient.get()
                        .uri(uri)
                        .retrieve()
                        .body(JsonNode.class);
                if (response == null) {
                    throw new IllegalStateException("Weather provider returned an empty response");
                }
                return response;
            } catch (RuntimeException exception) {
                lastFailure = exception;
                if (attempt == MAX_ATTEMPTS || !isTransient(exception)) {
                    throw exception;
                }
                log.info("Retrying {} after attempt {} failed: {}",
                        operation, attempt, exception.getMessage());
                pauseBeforeRetry(attempt);
            }
        }
        throw lastFailure == null
                ? new IllegalStateException("Weather provider request failed")
                : lastFailure;
    }

    private boolean isTransient(RuntimeException exception) {
        if (exception instanceof RestClientResponseException responseException) {
            int status = responseException.getStatusCode().value();
            return status == 429 || status >= 500;
        }
        return true;
    }

    private void pauseBeforeRetry(int attempt) {
        try {
            TimeUnit.MILLISECONDS.sleep(250L * attempt);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Weather request retry was interrupted", exception);
        }
    }

    private boolean isUsable(CachedForecast cached, Instant now, Duration maximumAge) {
        return cached != null
                && !cached.cachedAt().isAfter(now)
                && Duration.between(cached.cachedAt(), now).compareTo(maximumAge) <= 0;
    }

    private List<TripWeatherResponse.WeatherDay> mapDays(
            JsonNode forecast, LocalDate tripStart, LocalDate tripEnd, LocalDate today
    ) {
        JsonNode daily = forecast.path("daily");
        if (daily.isMissingNode()) return List.of();
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

    private record ForecastCacheKey(
            Long tripId,
            String destination,
            LocalDate startDate,
            LocalDate endDate
    ) {
    }

    private record CachedForecast(
            Instant cachedAt,
            TripWeatherResponse response
    ) {
    }
}

package com.tripmate.place;

import com.tripmate.discovery.provider.DestinationGeocodingService;
import com.tripmate.discovery.provider.GeocodedDestination;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlaceLocationServiceTest {

    @Mock
    private DestinationGeocodingService geocoder;

    @InjectMocks
    private PlaceLocationService service;

    private static GeocodedDestination at(String lat, String lon) {
        return new GeocodedDestination(new BigDecimal(lat), new BigDecimal(lon), "Somewhere, India", null, null, null, "IN", "test");
    }

    @Test
    @DisplayName("finds the place near its area")
    void locatesPlaceNearArea() {
        when(geocoder.geocode("Fort Aguada, Goa")).thenReturn(at("15.4920", "73.7732"));
        when(geocoder.geocode("Goa")).thenReturn(at("15.3004", "74.0855"));

        Optional<PlaceLocationService.Location> found = service.locate("Fort Aguada", "Goa", "Coorg");

        assertEquals(new BigDecimal("15.4920"), found.orElseThrow().latitude());
        verify(geocoder, never()).geocode("Fort Aguada, Coorg");
    }

    @Test
    @DisplayName("rejects a hit that is only the town centre, never inventing a location")
    void rejectsTownCentreFallback() {
        when(geocoder.geocode("Anjuna flea market, Goa")).thenReturn(at("15.3004", "74.0855"));
        when(geocoder.geocode("Goa")).thenReturn(at("15.3004", "74.0855"));

        assertTrue(service.locate("Anjuna flea market", "Goa").isEmpty());
    }

    @Test
    @DisplayName("rejects a same-named place far from the area and tries the next area")
    void rejectsFarAwayHitAndTriesNextArea() {
        when(geocoder.geocode("Raja Seat, Goa")).thenReturn(at("12.4210", "75.7380"));
        when(geocoder.geocode("Goa")).thenReturn(at("15.3004", "74.0855"));
        when(geocoder.geocode("Raja Seat, Madikeri")).thenReturn(at("12.4210", "75.7380"));
        when(geocoder.geocode("Madikeri")).thenReturn(at("12.4244", "75.7382"));

        assertEquals(new BigDecimal("12.4210"), service.locate("Raja Seat", "Goa", "Madikeri").orElseThrow().latitude());
    }

    @Test
    @DisplayName("leaves the place unmapped when the geocoder can't find it")
    void notFoundStaysUnmapped() {
        when(geocoder.geocode("Hidden Spot, Goa")).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND));

        assertTrue(service.locate("Hidden Spot", "Goa").isEmpty());
    }
}

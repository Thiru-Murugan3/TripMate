package com.tripmate.place;

import com.tripmate.discovery.provider.DestinationGeocodingService;
import com.tripmate.discovery.provider.GeocodedDestination;
import com.tripmate.place.PointOfInterestLookup.Candidate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlaceLocationServiceTest {

    @Mock
    private PointOfInterestLookup pointsOfInterest;

    @Mock
    private DestinationGeocodingService areaGeocoder;

    @InjectMocks
    private PlaceLocationService service;

    private static final GeocodedDestination GOA = new GeocodedDestination(new BigDecimal("15.3004"), new BigDecimal("74.0855"),
            "Goa, India", null, null, "Goa", "IN", "test");

    private static Candidate poi(String name, String key, String lat, String lon) {
        return new Candidate(name, key, new BigDecimal(lat), new BigDecimal(lon));
    }

    // Photon's real answers for the three places in the reported trip.
    @Test
    @DisplayName("finds each Goa place at its own spot, so the route has separate stops")
    void locatesEachPlaceSeparately() {
        when(areaGeocoder.geocode("Goa")).thenReturn(GOA);
        when(pointsOfInterest.search("Fort Aguada, Goa")).thenReturn(List.of(
                poi("Fort Aguada", "historic", "15.4923866", "73.7735976")));
        when(pointsOfInterest.search("Chapora Fort, Goa")).thenReturn(List.of(
                poi("Chapora Fort", "historic", "15.6059773", "73.7363109")));
        when(pointsOfInterest.search("Anjuna flea market, Goa")).thenReturn(List.of(
                poi("Anjuna Flea Market", "amenity", "15.5763909", "73.7439766")));

        assertEquals(new BigDecimal("15.4923866"), service.locate("Fort Aguada", "Goa").orElseThrow().latitude());
        assertEquals(new BigDecimal("15.6059773"), service.locate("Chapora Fort", "Goa").orElseThrow().latitude());
        assertEquals(new BigDecimal("15.5763909"), service.locate("Anjuna flea market", "Goa").orElseThrow().latitude());
    }

    @Test
    @DisplayName("accepts a reworded name such as 'Aguada Fort' for 'Fort Aguada'")
    void acceptsRewordedName() {
        when(areaGeocoder.geocode("Goa")).thenReturn(GOA);
        when(pointsOfInterest.search("Fort Aguada, Goa")).thenReturn(List.of(
                poi("Aguada Fort", "historic", "15.4923285", "73.7732044")));

        assertTrue(service.locate("Fort Aguada", "Goa").isPresent());
    }

    @Test
    @DisplayName("skips results with a different name and never falls back to the town centre")
    void rejectsDifferentNameAndTownCentre() {
        when(areaGeocoder.geocode("Goa")).thenReturn(GOA);
        when(pointsOfInterest.search("Hidden Viewpoint, Goa")).thenReturn(List.of(
                poi("Goa", "place", "15.3004", "74.0855"),
                poi("Some Other Viewpoint", "tourism", "15.40", "73.90")));

        assertTrue(service.locate("Hidden Viewpoint", "Goa").isEmpty());
    }

    @Test
    @DisplayName("rejects a same-named place far from the area and tries the next area")
    void rejectsFarAwayHitAndTriesNextArea() {
        GeocodedDestination madikeri = new GeocodedDestination(new BigDecimal("12.4244"), new BigDecimal("75.7382"),
                "Madikeri, India", "Madikeri", null, "Karnataka", "IN", "test");
        when(areaGeocoder.geocode("Goa")).thenReturn(GOA);
        when(areaGeocoder.geocode("Madikeri")).thenReturn(madikeri);
        when(pointsOfInterest.search("Raja Seat, Goa")).thenReturn(List.of(poi("Raja Seat", "tourism", "12.4210", "75.7380")));
        when(pointsOfInterest.search("Raja Seat, Madikeri")).thenReturn(List.of(poi("Raja Seat", "tourism", "12.4210", "75.7380")));

        assertEquals(new BigDecimal("12.4210"), service.locate("Raja Seat", "Goa", "Madikeri").orElseThrow().latitude());
    }

    @Test
    @DisplayName("leaves the place unmapped when the lookup service is down")
    void providerDownStaysUnmapped() {
        when(pointsOfInterest.search("Fort Aguada, Goa")).thenThrow(new RestClientException("down"));

        assertTrue(service.locate("Fort Aguada", "Goa").isEmpty());
    }
}

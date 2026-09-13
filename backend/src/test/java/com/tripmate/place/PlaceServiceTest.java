package com.tripmate.place;

import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMember;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlaceServiceTest {

    @Mock
    private PlaceRepository placeRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @InjectMocks
    private PlaceService placeService;

    private User owner;
    private User editorUser;
    private User viewerUser;
    private Trip trip;
    private Place place;
    private TripMember editorMember;
    private TripMember viewerMember;

    @BeforeEach
    void setUp() {
        owner = User.builder()
                .id(1L)
                .name("Owner User")
                .email("owner@example.com")
                .build();

        editorUser = User.builder()
                .id(2L)
                .name("Editor User")
                .email("editor@example.com")
                .build();

        viewerUser = User.builder()
                .id(3L)
                .name("Viewer User")
                .email("viewer@example.com")
                .build();

        trip = Trip.builder()
                .id(10L)
                .owner(owner)
                .name("Goa Beach Trip")
                .destination("Goa")
                .build();

        place = Place.builder()
                .id(100L)
                .trip(trip)
                .name("Baga Beach")
                .category(PlaceCategory.ATTRACTION)
                .latitude(new BigDecimal("15.5553"))
                .longitude(new BigDecimal("73.7517"))
                .estimatedCost(new BigDecimal("500.00"))
                .notes("Popular beach")
                .build();

        editorMember = TripMember.builder()
                .id(20L)
                .trip(trip)
                .user(editorUser)
                .role(TripRole.EDITOR)
                .memberStatus(MemberStatus.ACTIVE)
                .build();

        viewerMember = TripMember.builder()
                .id(30L)
                .trip(trip)
                .user(viewerUser)
                .role(TripRole.VIEWER)
                .memberStatus(MemberStatus.ACTIVE)
                .build();
    }

    @Test
    @DisplayName("createPlace: Trip owner creates place successfully")
    void createPlace_Owner_Success() {
        CreatePlaceRequest request = new CreatePlaceRequest(
                "Calangute Beach",
                PlaceCategory.ATTRACTION,
                new BigDecimal("15.5442"),
                new BigDecimal("73.7554"),
                new BigDecimal("300.00"),
                "Sunbed rental"
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> {
            Place p = inv.getArgument(0);
            p.setId(200L);
            return p;
        });

        PlaceResponse response = placeService.createPlace(10L, 1L, request);

        assertNotNull(response);
        assertEquals(200L, response.id());
        assertEquals("Calangute Beach", response.name());
        assertEquals(PlaceCategory.ATTRACTION, response.category());
        assertEquals(new BigDecimal("300.00"), response.estimatedCost());
    }

    @Test
    @DisplayName("createPlace: Trip EDITOR member creates place successfully")
    void createPlace_Editor_Success() {
        CreatePlaceRequest request = new CreatePlaceRequest(
                "Britto's Shack",
                PlaceCategory.RESTAURANT,
                null,
                null,
                new BigDecimal("1500.00"),
                "Seafood dinner"
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(10L, 2L, MemberStatus.ACTIVE))
                .thenReturn(Optional.of(editorMember));
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> {
            Place p = inv.getArgument(0);
            p.setId(201L);
            return p;
        });

        PlaceResponse response = placeService.createPlace(10L, 2L, request);

        assertNotNull(response);
        assertEquals(201L, response.id());
        assertEquals("Britto's Shack", response.name());
        assertEquals(PlaceCategory.RESTAURANT, response.category());
    }

    @Test
    @DisplayName("createPlace: Trip VIEWER member cannot create place (403 FORBIDDEN)")
    void createPlace_Viewer_ThrowsForbidden() {
        CreatePlaceRequest request = new CreatePlaceRequest(
                "Fort Aguada",
                PlaceCategory.ATTRACTION,
                null,
                null,
                BigDecimal.ZERO,
                "Sightseeing"
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(10L, 3L, MemberStatus.ACTIVE))
                .thenReturn(Optional.of(viewerMember));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> placeService.createPlace(10L, 3L, request));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("You do not have permission to edit places for this trip"));
    }

    @Test
    @DisplayName("getPlaces: Non-member cannot view places for trip (403 FORBIDDEN)")
    void getPlaces_OutsideUser_ThrowsForbidden() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(10L, 99L, MemberStatus.ACTIVE))
                .thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> placeService.getPlaces(10L, 99L));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("You do not have access to this trip"));
    }

    @Test
    @DisplayName("getPlaces: Fetches all places for trip successfully")
    void getPlaces_Owner_Success() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(placeRepository.findByTripIdOrderByIdAsc(10L)).thenReturn(List.of(place));

        List<PlaceResponse> result = placeService.getPlaces(10L, 1L);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Baga Beach", result.get(0).name());
    }

    @Test
    @DisplayName("getPlaceById: Retrieves place details by ID successfully")
    void getPlaceById_Owner_Success() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(placeRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.of(place));

        PlaceResponse response = placeService.getPlaceById(10L, 100L, 1L);

        assertNotNull(response);
        assertEquals(100L, response.id());
        assertEquals("Baga Beach", response.name());
    }

    @Test
    @DisplayName("getPlaceById: Non-existent place ID throws 404 NOT FOUND")
    void getPlaceById_NotFound_ThrowsNotFound() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(placeRepository.findByIdAndTripId(999L, 10L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> placeService.getPlaceById(10L, 999L, 1L));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Place not found"));
    }

    @Test
    @DisplayName("getPlaceById: Place belonging to another trip returns 404 NOT FOUND")
    void getPlaceById_BelongsToAnotherTrip_ThrowsNotFound() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(placeRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> placeService.getPlaceById(10L, 100L, 1L));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    @DisplayName("updatePlace: Owner updates place details successfully")
    void updatePlace_Owner_Success() {
        UpdatePlaceRequest request = new UpdatePlaceRequest(
                "Updated Baga Beach",
                PlaceCategory.ATTRACTION,
                new BigDecimal("15.5553"),
                new BigDecimal("73.7517"),
                new BigDecimal("750.00"),
                "Updated notes"
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(placeRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.of(place));
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));

        PlaceResponse response = placeService.updatePlace(10L, 100L, 1L, request);

        assertNotNull(response);
        assertEquals("Updated Baga Beach", response.name());
        assertEquals(new BigDecimal("750.00"), response.estimatedCost());
    }

    @Test
    @DisplayName("deletePlace: Owner deletes place successfully")
    void deletePlace_Owner_Success() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(placeRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.of(place));

        placeService.deletePlace(10L, 100L, 1L);

        verify(placeRepository, times(1)).delete(place);
    }

    @Test
    @DisplayName("createPlace: Non-existent trip throws 404 NOT FOUND")
    void createPlace_TripNotFound_ThrowsNotFound() {
        CreatePlaceRequest request = new CreatePlaceRequest(
                "Test Place",
                PlaceCategory.OTHER,
                null,
                null,
                BigDecimal.ZERO,
                null
        );

        when(tripRepository.findById(999L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> placeService.createPlace(999L, 1L, request));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Trip not found"));
    }
}

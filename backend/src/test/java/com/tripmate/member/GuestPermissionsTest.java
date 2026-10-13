package com.tripmate.member;

import com.tripmate.trip.*;
import com.tripmate.user.User;
import com.tripmate.place.*;
import com.tripmate.itinerary.*;
import com.tripmate.booking.*;
import com.tripmate.document.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class GuestPermissionsTest {
    @Mock TripRepository trips;
    @Mock TripMemberRepository members;
    @Mock PlaceRepository places;
    @InjectMocks PlaceService placeService;
    @InjectMocks ItineraryService itineraryService;
    @InjectMocks BookingService bookingService;
    @InjectMocks BookingMarketplaceService marketplace;
    @InjectMocks DocumentService documentService;
    @InjectMocks TripService tripService;

    @BeforeEach void setUp() {
        var owner = User.builder().id(1L).build();
        when(trips.findById(10L)).thenReturn(Optional.of(Trip.builder().id(10L).owner(owner).build()));
    }
    private void role(TripRole role) {
        when(members.findByTripIdAndUserIdAndMemberStatus(10L, 2L, MemberStatus.ACTIVE))
                .thenReturn(Optional.of(TripMember.builder().role(role).build()));
    }
    private void forbidden(org.junit.jupiter.api.function.Executable operation) {
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class, operation).getStatusCode());
    }
    @ParameterizedTest @EnumSource(value=TripRole.class, names={"PLANNER", "EXPENSE_MANAGER", "VIEWER"})
    void restrictedGuestsCannotChangeBookingsDocumentsOrTrip(TripRole role) {
        role(role);
        forbidden(() -> bookingService.createBooking(10L, 2L, null));
        forbidden(() -> marketplace.bookNow(10L, 2L, null));
        forbidden(() -> documentService.deleteDocument(10L, 5L, 2L));
        forbidden(() -> tripService.updateTrip(10L, 2L, new UpdateTripRequest("Trip", "Chennai", TripType.FRIENDS, java.time.LocalDate.now(), java.time.LocalDate.now(), 2, java.math.BigDecimal.ZERO, null, null, null)));
    }
    @ParameterizedTest @EnumSource(value=TripRole.class, names={"EXPENSE_MANAGER", "VIEWER"})
    void nonPlannersCannotEditPlans(TripRole role) {
        role(role);
        forbidden(() -> placeService.createPlace(10L, 2L, null));
        forbidden(() -> itineraryService.createDay(10L, 2L, null));
    }
    @ParameterizedTest @EnumSource(value=TripRole.class, names={"EDITOR", "PLANNER"})
    void plannersCanDeleteSavedPlaces(TripRole role) {
        role(role);
        when(places.findByIdAndTripId(5L, 10L)).thenReturn(Optional.of(new Place()));
        placeService.deletePlace(10L, 5L, 2L);
        verify(places).delete(any(Place.class));
    }
}

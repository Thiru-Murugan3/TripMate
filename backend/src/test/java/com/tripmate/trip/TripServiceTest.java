package com.tripmate.trip;

import com.tripmate.audit.AuditLogService;
import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMember;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private TripService tripService;

    private User owner;
    private User editorUser;
    private User viewerUser;
    private Trip trip;

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
                .name("Goa Trip")
                .destination("Goa")
                .tripType(TripType.FRIENDS)
                .startDate(LocalDate.now().plusDays(5))
                .endDate(LocalDate.now().plusDays(10))
                .travelerCount(3)
                .budget(new BigDecimal("15000.00"))
                .description("Beach vacation")
                .status(TripStatus.UPCOMING)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("createTrip: Owner creates trip successfully and automatically gets added as OWNER member")
    void createTrip_Owner_Success() {
        CreateTripRequest request = new CreateTripRequest(
                "Goa Trip",
                "Goa",
                TripType.FRIENDS,
                LocalDate.now().plusDays(5),
                LocalDate.now().plusDays(10),
                3,
                new BigDecimal("15000.00"),
                "Beach vacation",
                null
        );

        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> {
            Trip t = invocation.getArgument(0);
            t.setId(10L);
            return t;
        });

        TripResponse response = tripService.createTrip(1L, request);

        assertNotNull(response);
        assertEquals(10L, response.id());
        assertEquals("Goa Trip", response.name());
        assertEquals("Goa", response.destination());
        assertEquals(TripStatus.UPCOMING, response.status());
        assertEquals(TripRole.OWNER, response.userRole());

        verify(tripMemberRepository, times(1)).save(any(TripMember.class));
        verify(auditLogService, times(1)).log(eq(1L), eq(10L), any(), any(), eq(10L), any());
    }

    @Test
    @DisplayName("createTrip: Throws BAD_REQUEST when end date is before start date")
    void createTrip_EndDateBeforeStartDate_ThrowsBadRequest() {
        CreateTripRequest request = new CreateTripRequest(
                "Goa Trip",
                "Goa",
                TripType.FRIENDS,
                LocalDate.now().plusDays(10),
                LocalDate.now().plusDays(5),
                3,
                new BigDecimal("15000.00"),
                "Invalid dates",
                null
        );

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripService.createTrip(1L, request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("End date cannot be before start date"));
        verify(tripRepository, never()).save(any());
    }

    @Test
    @DisplayName("getTripById: Owner can view trip details")
    void getTripById_Owner_Success() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));

        TripResponse response = tripService.getTripById(10L, 1L);

        assertNotNull(response);
        assertEquals(10L, response.id());
        assertEquals("Goa Trip", response.name());
        assertEquals(TripRole.OWNER, response.userRole());
    }

    @Test
    @DisplayName("getTripById: Active member can view trip details")
    void getTripById_ActiveMember_Success() {
        TripMember editorMember = TripMember.builder()
                .trip(trip)
                .user(editorUser)
                .role(TripRole.EDITOR)
                .memberStatus(MemberStatus.ACTIVE)
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(10L, 2L, MemberStatus.ACTIVE))
                .thenReturn(Optional.of(editorMember));

        TripResponse response = tripService.getTripById(10L, 2L);

        assertNotNull(response);
        assertEquals(10L, response.id());
        assertEquals(TripRole.EDITOR, response.userRole());
    }

    @Test
    @DisplayName("getTripById: Outside user cannot view trip and gets 403 FORBIDDEN")
    void getTripById_OutsideUser_ThrowsForbidden() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(10L, 99L, MemberStatus.ACTIVE))
                .thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripService.getTripById(10L, 99L));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("You do not have access to this trip"));
    }

    @Test
    @DisplayName("getTripById: Throws 404 NOT_FOUND when trip does not exist")
    void getTripById_NotFound_ThrowsNotFound() {
        when(tripRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripService.getTripById(99L, 1L));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Trip not found"));
    }

    @Test
    @DisplayName("updateTrip: Owner updates trip details successfully")
    void updateTrip_Owner_Success() {
        UpdateTripRequest request = new UpdateTripRequest(
                "Updated Goa Trip",
                "North Goa",
                TripType.COUPLE,
                LocalDate.now().plusDays(2),
                LocalDate.now().plusDays(8),
                2,
                new BigDecimal("20000.00"),
                "Updated description",
                null,
                TripStatus.PLANNED
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripResponse response = tripService.updateTrip(10L, 1L, request);

        assertNotNull(response);
        assertEquals("Updated Goa Trip", response.name());
        assertEquals("North Goa", response.destination());
        assertEquals(TripType.COUPLE, response.tripType());
        assertEquals(TripRole.OWNER, response.userRole());
    }

    @Test
    @DisplayName("updateTrip: Editor member updates trip successfully")
    void updateTrip_Editor_Success() {
        TripMember editorMember = TripMember.builder()
                .trip(trip)
                .user(editorUser)
                .role(TripRole.EDITOR)
                .memberStatus(MemberStatus.ACTIVE)
                .build();

        UpdateTripRequest request = new UpdateTripRequest(
                "Goa Trip",
                "Goa",
                TripType.FRIENDS,
                LocalDate.now().plusDays(5),
                LocalDate.now().plusDays(10),
                4,
                new BigDecimal("18000.00"),
                "Updated by editor",
                null,
                null
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(10L, 2L, MemberStatus.ACTIVE))
                .thenReturn(Optional.of(editorMember));
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripResponse response = tripService.updateTrip(10L, 2L, request);

        assertNotNull(response);
        assertEquals(4, response.travelerCount());
        assertEquals(TripRole.EDITOR, response.userRole());
    }

    @Test
    @DisplayName("updateTrip: Viewer member cannot update trip and gets 403 FORBIDDEN")
    void updateTrip_Viewer_ThrowsForbidden() {
        TripMember viewerMember = TripMember.builder()
                .trip(trip)
                .user(viewerUser)
                .role(TripRole.VIEWER)
                .memberStatus(MemberStatus.ACTIVE)
                .build();

        UpdateTripRequest request = new UpdateTripRequest(
                "Goa Trip",
                "Goa",
                TripType.FRIENDS,
                LocalDate.now().plusDays(5),
                LocalDate.now().plusDays(10),
                4,
                new BigDecimal("18000.00"),
                "Attempt by viewer",
                null,
                null
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(10L, 3L, MemberStatus.ACTIVE))
                .thenReturn(Optional.of(viewerMember));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripService.updateTrip(10L, 3L, request));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("You do not have edit permission for this trip"));
    }

    @Test
    @DisplayName("deleteTrip: Owner deletes trip successfully")
    void deleteTrip_Owner_Success() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));

        tripService.deleteTrip(10L, 1L);

        verify(tripRepository, times(1)).delete(trip);
        verify(auditLogService, times(1)).log(eq(1L), eq(10L), any(), any(), eq(10L), any());
    }

    @Test
    @DisplayName("deleteTrip: Non-owner gets 403 FORBIDDEN when attempting to delete trip")
    void deleteTrip_NonOwner_ThrowsForbidden() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripService.deleteTrip(10L, 2L));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Only the trip owner can delete this trip"));
        verify(tripRepository, never()).delete(any());
    }

    @Test
    @DisplayName("getMyTrips: Returns both owned and member trips sorted by start date")
    void getMyTrips_ReturnsCombinedTrips() {
        Trip trip2 = Trip.builder()
                .id(20L)
                .owner(editorUser)
                .name("Manali Trip")
                .destination("Manali")
                .tripType(TripType.ADVENTURE)
                .startDate(LocalDate.now().plusDays(15))
                .endDate(LocalDate.now().plusDays(20))
                .status(TripStatus.UPCOMING)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        TripMember member2 = TripMember.builder()
                .trip(trip2)
                .user(owner)
                .role(TripRole.EDITOR)
                .memberStatus(MemberStatus.ACTIVE)
                .build();

        when(tripRepository.findByOwnerIdOrderByStartDateDesc(1L)).thenReturn(List.of(trip));
        when(tripMemberRepository.findByUserIdAndMemberStatus(1L, MemberStatus.ACTIVE)).thenReturn(List.of(member2));

        List<TripResponse> myTrips = tripService.getMyTrips(1L);

        assertNotNull(myTrips);
        assertEquals(2, myTrips.size());
        assertEquals("Manali Trip", myTrips.get(0).name()); // Starts later (plusDays 15)
        assertEquals(TripRole.EDITOR, myTrips.get(0).userRole());
        assertEquals("Goa Trip", myTrips.get(1).name());    // Starts earlier (plusDays 5)
        assertEquals(TripRole.OWNER, myTrips.get(1).userRole());
    }
}

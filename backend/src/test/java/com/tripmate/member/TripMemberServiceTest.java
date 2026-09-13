package com.tripmate.member;

import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripMemberServiceTest {

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private TripMemberService tripMemberService;

    private User owner;
    private User memberUser;
    private User newTargetUser;
    private Trip trip;
    private TripMember member;

    @BeforeEach
    void setUp() {
        owner = User.builder()
                .id(1L)
                .name("Owner")
                .email("owner@example.com")
                .build();

        memberUser = User.builder()
                .id(2L)
                .name("Member")
                .email("member@example.com")
                .build();

        newTargetUser = User.builder()
                .id(3L)
                .name("Target")
                .email("target@example.com")
                .build();

        trip = Trip.builder()
                .id(10L)
                .owner(owner)
                .name("Kerala Tour")
                .destination("Kerala")
                .build();

        member = TripMember.builder()
                .id(100L)
                .trip(trip)
                .user(memberUser)
                .role(TripRole.VIEWER)
                .memberStatus(MemberStatus.ACTIVE)
                .joinedAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("getTripMembers: Owner fetches active members successfully")
    void getTripMembers_Owner_Success() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findByTripIdAndMemberStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(member));

        List<TripMemberResponse> responseList = tripMemberService.getTripMembers(10L, 1L);

        assertNotNull(responseList);
        assertEquals(1, responseList.size());
        assertEquals("member@example.com", responseList.get(0).userEmail());
        assertEquals(TripRole.VIEWER, responseList.get(0).role());
    }

    @Test
    @DisplayName("getTripMembers: Non-member gets 403 FORBIDDEN")
    void getTripMembers_OutsideUser_ThrowsForbidden() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(10L, 99L, MemberStatus.ACTIVE))
                .thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripMemberService.getTripMembers(10L, 99L));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("You do not have access to this trip"));
    }

    @Test
    @DisplayName("addMember: Owner adds new registered user as EDITOR successfully")
    void addMember_Owner_Success() {
        AddMemberRequest request = new AddMemberRequest("target@example.com", TripRole.EDITOR);

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(userRepository.findByEmailIgnoreCase("target@example.com")).thenReturn(Optional.of(newTargetUser));
        when(tripMemberRepository.findByTripIdAndUserId(10L, 3L)).thenReturn(Optional.empty());
        when(tripMemberRepository.save(any(TripMember.class))).thenAnswer(invocation -> {
            TripMember tm = invocation.getArgument(0);
            tm.setId(200L);
            return tm;
        });

        TripMemberResponse response = tripMemberService.addMember(10L, 1L, request);

        assertNotNull(response);
        assertEquals(200L, response.id());
        assertEquals(3L, response.userId());
        assertEquals(TripRole.EDITOR, response.role());
    }

    @Test
    @DisplayName("addMember: Non-owner attempt throws 403 FORBIDDEN")
    void addMember_NonOwner_ThrowsForbidden() {
        AddMemberRequest request = new AddMemberRequest("target@example.com", TripRole.EDITOR);

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripMemberService.addMember(10L, 2L, request));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Only the trip owner can perform this action"));
    }

    @Test
    @DisplayName("addMember: Cannot assign OWNER role throws 400 BAD REQUEST")
    void addMember_AssignOwnerRole_ThrowsBadRequest() {
        AddMemberRequest request = new AddMemberRequest("target@example.com", TripRole.OWNER);

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripMemberService.addMember(10L, 1L, request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Cannot assign OWNER role to a member"));
    }

    @Test
    @DisplayName("addMember: Non-existent user email throws 404 NOT FOUND")
    void addMember_UserNotFound_ThrowsNotFound() {
        AddMemberRequest request = new AddMemberRequest("unknown@example.com", TripRole.VIEWER);

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(userRepository.findByEmailIgnoreCase("unknown@example.com")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripMemberService.addMember(10L, 1L, request));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertTrue(ex.getReason().contains("No registered user found"));
    }

    @Test
    @DisplayName("addMember: Target user already active member throws 409 CONFLICT")
    void addMember_AlreadyActiveMember_ThrowsConflict() {
        AddMemberRequest request = new AddMemberRequest("member@example.com", TripRole.VIEWER);

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(userRepository.findByEmailIgnoreCase("member@example.com")).thenReturn(Optional.of(memberUser));
        when(tripMemberRepository.findByTripIdAndUserId(10L, 2L)).thenReturn(Optional.of(member));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripMemberService.addMember(10L, 1L, request));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().contains("User is already an active member of this trip"));
    }

    @Test
    @DisplayName("updateMemberRole: Owner updates member role from VIEWER to EDITOR")
    void updateMemberRole_Owner_Success() {
        UpdateMemberRoleRequest request = new UpdateMemberRoleRequest(TripRole.EDITOR);

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findById(100L)).thenReturn(Optional.of(member));
        when(tripMemberRepository.save(any(TripMember.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripMemberResponse response = tripMemberService.updateMemberRole(10L, 100L, 1L, request);

        assertNotNull(response);
        assertEquals(TripRole.EDITOR, response.role());
    }

    @Test
    @DisplayName("removeMember: Owner removes member successfully")
    void removeMember_Owner_Success() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findById(100L)).thenReturn(Optional.of(member));

        tripMemberService.removeMember(10L, 100L, 1L);

        assertEquals(MemberStatus.REMOVED, member.getMemberStatus());
        verify(tripMemberRepository, times(1)).save(member);
    }

    @Test
    @DisplayName("removeMember: Member leaves trip (self removal) successfully")
    void removeMember_SelfLeave_Success() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findById(100L)).thenReturn(Optional.of(member));

        tripMemberService.removeMember(10L, 100L, 2L); // 2L is memberUser ID

        assertEquals(MemberStatus.REMOVED, member.getMemberStatus());
        verify(tripMemberRepository, times(1)).save(member);
    }

    @Test
    @DisplayName("removeMember: Unauthorized user removing another member gets 403 FORBIDDEN")
    void removeMember_NonOwnerRemovingOther_ThrowsForbidden() {
        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.findById(100L)).thenReturn(Optional.of(member));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> tripMemberService.removeMember(10L, 100L, 3L)); // 3L is another user

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("You do not have permission to remove this member"));
    }
}

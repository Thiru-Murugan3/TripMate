package com.tripmate.invitation;

import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMember;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.notification.NotificationService;
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
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripInvitationServiceTest {

    @Mock
    private TripInvitationRepository tripInvitationRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private com.tripmate.audit.AuditLogService auditLogService;

    @InjectMocks
    private TripInvitationService tripInvitationService;

    private User owner;
    private User invitee;
    private Trip testTrip;

    @BeforeEach
    void setUp() {
        owner = User.builder().id(1L).name("Owner User").email("owner@example.com").build();
        invitee = User.builder().id(2L).name("Invitee User").email("friend@example.com").build();
        testTrip = Trip.builder().id(10L).name("Kodaikanal Trip").owner(owner).build();
    }

    @Test
    @DisplayName("createInvitation: Success when Owner invites friend as EDITOR")
    void createInvitation_Success() {
        CreateInvitationRequest request = CreateInvitationRequest.builder()
                .email("friend@example.com")
                .role(TripRole.EDITOR)
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(testTrip));
        when(userRepository.findByEmailIgnoreCase("friend@example.com")).thenReturn(Optional.of(invitee));
        when(tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(10L, 2L, MemberStatus.ACTIVE)).thenReturn(false);
        when(tripInvitationRepository.existsByTripIdAndInviteeEmailIgnoreCaseAndStatus(10L, "friend@example.com", InvitationStatus.PENDING)).thenReturn(false);
        when(tripInvitationRepository.save(any(TripInvitation.class))).thenAnswer(i -> i.getArgument(0));

        InvitationResponse response = tripInvitationService.createInvitation(10L, 1L, request);

        assertNotNull(response);
        assertEquals(TripRole.EDITOR, response.getRole());
        assertEquals(InvitationStatus.PENDING, response.getStatus());
        verify(tripInvitationRepository).save(any(TripInvitation.class));
        verify(notificationService).createAndSendNotification(eq(invitee), eq(testTrip), anyString(), anyString(), any());
    }

    @Test
    @DisplayName("createInvitation: Throws 403 when non-owner tries to invite")
    void createInvitation_NonOwnerForbidden() {
        CreateInvitationRequest request = CreateInvitationRequest.builder()
                .email("friend@example.com")
                .role(TripRole.EDITOR)
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(testTrip));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> tripInvitationService.createInvitation(10L, 99L, request) // 99L is not owner
        );

        assertTrue(ex.getReason().contains("Only the trip owner"));
    }

    @Test
    @DisplayName("createInvitation: Throws 400 when attempting to assign OWNER role")
    void createInvitation_AssignOwnerRoleForbidden() {
        CreateInvitationRequest request = CreateInvitationRequest.builder()
                .email("friend@example.com")
                .role(TripRole.OWNER) // Invalid!
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(testTrip));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> tripInvitationService.createInvitation(10L, 1L, request)
        );

        assertTrue(ex.getReason().contains("Cannot invite user with OWNER role"));
    }

    @Test
    @DisplayName("createInvitation: Throws 400 when user is already an active member")
    void createInvitation_AlreadyActiveMember() {
        CreateInvitationRequest request = CreateInvitationRequest.builder()
                .email("friend@example.com")
                .role(TripRole.VIEWER)
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(testTrip));
        when(userRepository.findByEmailIgnoreCase("friend@example.com")).thenReturn(Optional.of(invitee));
        when(tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(10L, 2L, MemberStatus.ACTIVE)).thenReturn(true);

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> tripInvitationService.createInvitation(10L, 1L, request)
        );

        assertTrue(ex.getReason().contains("already an active member"));
    }

    @Test
    @DisplayName("acceptInvitation: Success accepts invitation and creates active TripMember in one transaction")
    void acceptInvitation_Success() {
        TripInvitation invitation = TripInvitation.builder()
                .id(100L)
                .trip(testTrip)
                .inviter(owner)
                .inviteeEmail("friend@example.com")
                .type(InvitationType.EMAIL)
                .role(TripRole.EDITOR)
                .status(InvitationStatus.PENDING)
                .expiresAt(LocalDateTime.now().plusDays(5))
                .build();

        when(tripInvitationRepository.findById(100L)).thenReturn(Optional.of(invitation));
        when(userRepository.findById(2L)).thenReturn(Optional.of(invitee));
        when(tripMemberRepository.findByTripIdAndUserId(10L, 2L)).thenReturn(Optional.empty());

        InvitationResponse response = tripInvitationService.acceptInvitation(100L, 2L);

        assertNotNull(response);
        assertEquals(InvitationStatus.ACCEPTED, invitation.getStatus());
        verify(tripMemberRepository).save(argThat(member ->
                member.getRole() == TripRole.EDITOR &&
                member.getMemberStatus() == MemberStatus.ACTIVE &&
                member.getUser().getId().equals(2L)
        ));
        verify(notificationService).createAndSendNotification(eq(owner), eq(testTrip), anyString(), anyString(), any());
    }


    @Test
    @DisplayName("acceptInvitation: Rejects a signed-in user whose email does not match the email invitation")
    void acceptInvitation_EmailRecipientMismatchForbidden() {
        TripInvitation invitation = TripInvitation.builder()
                .id(101L)
                .trip(testTrip)
                .inviter(owner)
                .inviteeEmail("someone-else@example.com")
                .type(InvitationType.EMAIL)
                .role(TripRole.VIEWER)
                .status(InvitationStatus.PENDING)
                .expiresAt(LocalDateTime.now().plusDays(5))
                .build();

        when(tripInvitationRepository.findById(101L)).thenReturn(Optional.of(invitation));
        when(userRepository.findById(2L)).thenReturn(Optional.of(invitee));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> tripInvitationService.acceptInvitation(101L, 2L)
        );

        assertEquals(403, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("different email address"));
        assertEquals(InvitationStatus.PENDING, invitation.getStatus());
        verify(tripMemberRepository, never()).save(any(TripMember.class));
    }

    @Test
    @DisplayName("acceptInvitation: Throws 400 when invitation is expired")
    void acceptInvitation_Expired() {
        TripInvitation expiredInvitation = TripInvitation.builder()
                .id(100L)
                .trip(testTrip)
                .inviter(owner)
                .status(InvitationStatus.PENDING)
                .expiresAt(LocalDateTime.now().minusDays(1)) // Expired
                .build();

        when(tripInvitationRepository.findById(100L)).thenReturn(Optional.of(expiredInvitation));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> tripInvitationService.acceptInvitation(100L, 2L)
        );

        assertEquals(InvitationStatus.EXPIRED, expiredInvitation.getStatus());
        assertTrue(ex.getReason().contains("expired"));
    }
}

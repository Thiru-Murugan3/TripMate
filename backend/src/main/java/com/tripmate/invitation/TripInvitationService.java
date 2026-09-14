package com.tripmate.invitation;

import com.tripmate.audit.AuditAction;
import com.tripmate.auth.EmailService;
import com.tripmate.audit.AuditLogService;
import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMember;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.notification.NotificationService;
import com.tripmate.notification.NotificationType;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TripInvitationService {

    private final TripInvitationRepository tripInvitationRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final EmailService emailService;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendBaseUrl;

    @Transactional
    public InvitationResponse createInvitation(Long tripId, Long inviterUserId, CreateInvitationRequest request) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));

        // 1. Only the Trip Owner can create invitations
        if (!trip.getOwner().getId().equals(inviterUserId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Only the trip owner can create invitations");
        }

        // 2. Never allow an invitation to assign OWNER
        if (request.getRole() == TripRole.OWNER) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Cannot invite user with OWNER role");
        }

        String email = request.getEmail() != null && !request.getEmail().isBlank() ? request.getEmail().trim().toLowerCase() : null;
        String mobile = request.getMobileNumber() != null && !request.getMobileNumber().isBlank() ? request.getMobileNumber().trim() : null;

        InvitationType invitationType = request.getType();
        if (invitationType == null) {
            if (email != null) {
                invitationType = InvitationType.EMAIL;
            } else if (mobile != null) {
                invitationType = InvitationType.MOBILE;
            } else {
                invitationType = InvitationType.LINK;
            }
        }

        // 3. Validation: Don't invite someone who is already an ACTIVE member or has active PENDING invitation
        User inviteeUser = null;

        if (email != null) {
            Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
            if (userOpt.isPresent()) {
                inviteeUser = userOpt.get();
                if (tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(tripId, inviteeUser.getId(), MemberStatus.ACTIVE)) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "User is already an active member of this trip");
                }
            }
            if (tripInvitationRepository.existsByTripIdAndInviteeEmailIgnoreCaseAndStatus(tripId, email, InvitationStatus.PENDING)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Active pending invitation already exists for this email");
            }
        } else if (mobile != null) {
            Optional<User> userOpt = userRepository.findByMobile(mobile);
            if (userOpt.isPresent()) {
                inviteeUser = userOpt.get();
                if (tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(tripId, inviteeUser.getId(), MemberStatus.ACTIVE)) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "User is already an active member of this trip");
                }
            }
            if (tripInvitationRepository.existsByTripIdAndInviteeMobileAndStatus(tripId, mobile, InvitationStatus.PENDING)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Active pending invitation already exists for this mobile number");
            }
        }

        // 4. Generate random invitation token and hash
        String rawToken = UUID.randomUUID().toString();
        String tokenHash = hashToken(rawToken);

        TripInvitation invitation = TripInvitation.builder()
                .trip(trip)
                .inviter(trip.getOwner())
                .inviteeEmail(email)
                .inviteeMobile(mobile)
                .tokenHash(tokenHash)
                .role(request.getRole())
                .status(InvitationStatus.PENDING)
                .type(invitationType)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();

        TripInvitation saved = tripInvitationRepository.save(invitation);

        // Notification: send notification if invitee registered in system
        if (inviteeUser != null) {
            notificationService.createAndSendNotification(
                    inviteeUser,
                    trip,
                    "Trip Invitation",
                    trip.getOwner().getName() + " invited you to join " + trip.getName() + " as " + request.getRole(),
                    NotificationType.MEMBER_ADDED
            );
        }

        // Audit Log
        auditLogService.log(
                inviterUserId,
                tripId,
                AuditAction.INVITATION_CREATED,
                "INVITATION",
                saved.getId(),
                "Created invitation for " +
                        (email != null ? email : mobile != null ? mobile : "share link") +
                        " as " + request.getRole()
        );

        if (invitationType == InvitationType.EMAIL) {
            String invitationLink = buildInvitationLink(rawToken);
            emailService.sendTripInvitationEmail(
                    email,
                    trip.getOwner().getName(),
                    trip.getName(),
                    request.getRole().name(),
                    invitationLink
            );
        }

        return InvitationResponse.from(saved, rawToken, frontendBaseUrl);
    }

    @Transactional(readOnly = true)
    public List<InvitationResponse> getTripInvitations(Long tripId, Long userId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));

        if (!trip.getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Only trip owner can view invitations for this trip");
        }

        return tripInvitationRepository.findByTripIdOrderByCreatedAtDesc(tripId)
                .stream()
                .map(inv -> InvitationResponse.from(inv, null, frontendBaseUrl))
                .toList();
    }

    @Transactional
    public List<InvitationResponse> getMyInvitations(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<TripInvitation> invitations = new ArrayList<>();

        if (user.getEmail() != null) {
            invitations.addAll(tripInvitationRepository.findByInviteeEmailIgnoreCaseAndStatus(user.getEmail(), InvitationStatus.PENDING));
        }
        if (user.getMobile() != null) {
            invitations.addAll(tripInvitationRepository.findByInviteeMobileAndStatus(user.getMobile(), InvitationStatus.PENDING));
        }

        List<InvitationResponse> responseList = new ArrayList<>();
        for (TripInvitation inv : invitations) {
            if (inv.getExpiresAt().isBefore(LocalDateTime.now())) {
                inv.setStatus(InvitationStatus.EXPIRED);
                tripInvitationRepository.save(inv);
            } else {
                responseList.add(InvitationResponse.from(inv, null, frontendBaseUrl));
            }
        }

        return responseList;
    }

    @Transactional
    public InvitationResponse getInvitationByToken(String rawToken) {
        String tokenHash = hashToken(rawToken);
        TripInvitation invitation = tripInvitationRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found"));

        if (invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            if (invitation.getStatus() == InvitationStatus.PENDING) {
                invitation.setStatus(InvitationStatus.EXPIRED);
                tripInvitationRepository.save(invitation);
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation has expired");
        }

        return InvitationResponse.from(invitation, rawToken, frontendBaseUrl);
    }

    @Transactional
    public InvitationResponse acceptInvitation(Long invitationId, Long userId) {
        TripInvitation invitation = tripInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found"));

        return processAcceptance(invitation, userId);
    }

    @Transactional
    public InvitationResponse acceptInvitationByToken(String rawToken, Long userId) {
        String tokenHash = hashToken(rawToken);
        TripInvitation invitation = tripInvitationRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found"));

        return processAcceptance(invitation, userId);
    }

    private InvitationResponse processAcceptance(TripInvitation invitation, Long userId) {
        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invitation is no longer valid or has already been processed");
        }

        if (invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            tripInvitationRepository.save(invitation);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation has expired");
        }

        User acceptingUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        validateInvitationRecipient(invitation, acceptingUser);

        Trip trip = invitation.getTrip();

        // Check user is not already owner
        if (trip.getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You are already the owner of this trip");
        }

        // 1. Set status ACCEPTED
        invitation.setStatus(InvitationStatus.ACCEPTED);
        tripInvitationRepository.save(invitation);

        // 2. Create or reactivate TripMember in same transaction with strictly assigned invitation role
        TripMember member = tripMemberRepository.findByTripIdAndUserId(trip.getId(), userId)
                .orElseGet(() -> TripMember.builder()
                        .trip(trip)
                        .user(acceptingUser)
                        .build());

        member.setRole(invitation.getRole());
        member.setMemberStatus(MemberStatus.ACTIVE);
        member.setJoinedAt(LocalDateTime.now());
        tripMemberRepository.save(member);

        // 3. Notify Trip Owner
        notificationService.createAndSendNotification(
                trip.getOwner(),
                trip,
                "Invitation Accepted",
                acceptingUser.getName() + " accepted your invitation to join " + trip.getName() + " as " + invitation.getRole(),
                NotificationType.MEMBER_ADDED
        );

        // Audit Log
        auditLogService.log(userId, trip.getId(), AuditAction.INVITATION_ACCEPTED, "INVITATION", invitation.getId(), "Accepted invitation to join trip: " + trip.getName());
        auditLogService.log(userId, trip.getId(), AuditAction.MEMBER_ADDED, "TRIP_MEMBER", member.getId(), "Added as " + invitation.getRole() + " to trip: " + trip.getName());

        return InvitationResponse.from(invitation, null, frontendBaseUrl);
    }

    @Transactional
    public InvitationResponse rejectInvitation(Long invitationId, Long userId) {
        TripInvitation invitation = tripInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found"));

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invitation is no longer valid or has already been processed");
        }

        User rejectingUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        validateInvitationRecipient(invitation, rejectingUser);

        invitation.setStatus(InvitationStatus.REJECTED);
        TripInvitation updated = tripInvitationRepository.save(invitation);

        // Notify Trip Owner
        notificationService.createAndSendNotification(
                invitation.getTrip().getOwner(),
                invitation.getTrip(),
                "Invitation Rejected",
                rejectingUser.getName() + " declined your invitation to join " + invitation.getTrip().getName(),
                NotificationType.MEMBER_REMOVED
        );

        // Audit Log
        auditLogService.log(userId, invitation.getTrip().getId(), AuditAction.INVITATION_REJECTED, "INVITATION", invitation.getId(), "Rejected invitation for trip: " + invitation.getTrip().getName());

        return InvitationResponse.from(updated, null, frontendBaseUrl);
    }

    @Transactional
    public void cancelInvitation(Long tripId, Long invitationId, Long userId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));

        if (!trip.getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only trip owner can cancel invitations");
        }

        TripInvitation invitation = tripInvitationRepository.findByIdAndTripId(invitationId, tripId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found"));

        invitation.setStatus(InvitationStatus.CANCELLED);
        tripInvitationRepository.save(invitation);
    }

    private String buildInvitationLink(String rawToken) {
        String configuredBaseUrl =
                frontendBaseUrl == null || frontendBaseUrl.isBlank()
                        ? "http://localhost:4200"
                        : frontendBaseUrl;

        String normalizedBaseUrl = configuredBaseUrl.replaceAll("/+$", "");
        return normalizedBaseUrl + "/invite/" + rawToken;
    }

    private void validateInvitationRecipient(TripInvitation invitation, User user) {
        if (invitation.getType() == InvitationType.LINK) {
            return;
        }

        if (invitation.getType() == InvitationType.EMAIL) {
            String inviteeEmail = invitation.getInviteeEmail();
            if (inviteeEmail == null
                    || user.getEmail() == null
                    || !inviteeEmail.equalsIgnoreCase(user.getEmail())) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "This invitation was sent to a different email address"
                );
            }
            return;
        }

        if (invitation.getType() == InvitationType.MOBILE) {
            String inviteeMobile = invitation.getInviteeMobile();
            if (inviteeMobile == null
                    || user.getMobile() == null
                    || !inviteeMobile.equals(user.getMobile())) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "This invitation was sent to a different mobile number"
                );
            }
        }
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to hash token", ex);
        }
    }
}

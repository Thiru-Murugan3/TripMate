package com.tripmate.member;

import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TripMemberService {

    private final TripMemberRepository tripMemberRepository;
    private final TripRepository tripRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<TripMemberResponse> getTripMembers(Long tripId, Long currentUserId) {

        Trip trip = findTripOrThrow(tripId);

        // Verify current user has access (Owner or active Member)
        verifyUserHasTripAccess(trip, currentUserId);

        return tripMemberRepository.findByTripIdAndMemberStatus(tripId, MemberStatus.ACTIVE)
                .stream()
                .map(TripMemberResponse::from)
                .toList();
    }

    @Transactional
    public TripMemberResponse addMember(Long tripId, Long currentUserId, AddMemberRequest request) {

        Trip trip = findTripOrThrow(tripId);

        // Only the Trip Owner can add members (PRD Section 7 & 14)
        verifyIsTripOwner(trip, currentUserId);

        if (request.role() == TripRole.OWNER) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Cannot assign OWNER role to a member");
        }

        String targetEmail = request.email().trim().toLowerCase();

        User userToAdd = userRepository.findByEmailIgnoreCase(targetEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No registered user found with email: " + targetEmail));

        // Cannot add the owner
        if (trip.getOwner().getId().equals(userToAdd.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Trip owner is already part of the trip");
        }

        // Check existing membership
        var existingMemberOpt = tripMemberRepository.findByTripIdAndUserId(tripId, userToAdd.getId());

        TripMember memberToSave;
        if (existingMemberOpt.isPresent()) {
            TripMember existing = existingMemberOpt.get();
            if (existing.getMemberStatus() == MemberStatus.ACTIVE) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "User is already an active member of this trip");
            }
            // Re-activate previously removed member
            existing.setMemberStatus(MemberStatus.ACTIVE);
            existing.setRole(request.role());
            existing.setJoinedAt(LocalDateTime.now());
            memberToSave = existing;
        } else {
            memberToSave = TripMember.builder()
                    .trip(trip)
                    .user(userToAdd)
                    .role(request.role())
                    .memberStatus(MemberStatus.ACTIVE)
                    .joinedAt(LocalDateTime.now())
                    .build();
        }

        TripMember saved = tripMemberRepository.save(memberToSave);
        return TripMemberResponse.from(saved);
    }

    @Transactional
    public TripMemberResponse updateMemberRole(
            Long tripId,
            Long memberId,
            Long currentUserId,
            UpdateMemberRoleRequest request
    ) {
        Trip trip = findTripOrThrow(tripId);

        // Only the Trip Owner can change member roles
        verifyIsTripOwner(trip, currentUserId);

        if (request.role() == TripRole.OWNER) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Cannot assign OWNER role via member update");
        }

        TripMember member = tripMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip member not found"));

        if (!member.getTrip().getId().equals(tripId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Member does not belong to this trip");
        }

        if (member.getRole() == TripRole.OWNER) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Cannot modify trip owner role");
        }

        member.setRole(request.role());
        TripMember updated = tripMemberRepository.save(member);

        return TripMemberResponse.from(updated);
    }

    @Transactional
    public void removeMember(Long tripId, Long memberId, Long currentUserId) {

        Trip trip = findTripOrThrow(tripId);

        TripMember member = tripMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip member not found"));

        if (!member.getTrip().getId().equals(tripId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Member does not belong to this trip");
        }

        if (member.getRole() == TripRole.OWNER) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Cannot remove the trip owner");
        }

        // Allowed if: caller is Trip Owner OR caller is removing themselves (leaving the trip)
        boolean isOwner = trip.getOwner().getId().equals(currentUserId);
        boolean isSelf = member.getUser().getId().equals(currentUserId);

        if (!isOwner && !isSelf) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "You do not have permission to remove this member");
        }

        member.setMemberStatus(MemberStatus.REMOVED);
        tripMemberRepository.save(member);
    }

    private Trip findTripOrThrow(Long tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip not found"));
    }

    private void verifyIsTripOwner(Trip trip, Long userId) {
        if (!trip.getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Only the trip owner can perform this action");
        }
    }

    private void verifyUserHasTripAccess(Trip trip, Long userId) {
        if (trip.getOwner().getId().equals(userId)) {
            return;
        }
        boolean isMember = tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(
                trip.getId(), userId, MemberStatus.ACTIVE);
        if (!isMember) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "You do not have access to this trip");
        }
    }
}

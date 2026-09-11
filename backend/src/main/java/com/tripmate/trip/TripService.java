package com.tripmate.trip;

import com.tripmate.audit.AuditAction;
import com.tripmate.audit.AuditLogService;
import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMember;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TripService {

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    @Transactional
    public TripResponse createTrip(Long userId, CreateTripRequest request) {

        validateDates(request.startDate(), request.endDate());

        User owner = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));

        TripStatus computedStatus = calculateStatus(
                request.startDate(),
                request.endDate()
        );

        Trip trip = Trip.builder()
                .owner(owner)
                .name(request.name().trim())
                .destination(request.destination().trim())
                .tripType(request.tripType())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .travelerCount(request.travelerCount() != null ? request.travelerCount() : 1)
                .budget(request.budget() != null ? request.budget() : BigDecimal.ZERO)
                .description(request.description())
                .coverImageUrl(request.coverImageUrl())
                .status(computedStatus)
                .build();

        Trip savedTrip = tripRepository.save(trip);

        // Automatically add owner to trip_members
        TripMember ownerMember = TripMember.builder()
                .trip(savedTrip)
                .user(owner)
                .role(TripRole.OWNER)
                .memberStatus(MemberStatus.ACTIVE)
                .joinedAt(LocalDateTime.now())
                .build();
        tripMemberRepository.save(ownerMember);

        // Audit Log
        auditLogService.log(userId, savedTrip.getId(), AuditAction.TRIP_CREATED, "TRIP", savedTrip.getId(), "Created trip: " + savedTrip.getName());

        return TripResponse.from(savedTrip);
    }

    @Transactional(readOnly = true)
    public List<TripResponse> getMyTrips(Long userId) {

        Map<Long, Trip> tripMap = new LinkedHashMap<>();

        // Trips owned by user
        List<Trip> ownedTrips = tripRepository.findByOwnerIdOrderByStartDateDesc(userId);
        for (Trip t : ownedTrips) {
            tripMap.put(t.getId(), t);
        }

        // Trips shared with user
        List<TripMember> memberships = tripMemberRepository.findByUserIdAndMemberStatus(userId, MemberStatus.ACTIVE);
        for (TripMember member : memberships) {
            Trip t = member.getTrip();
            tripMap.putIfAbsent(t.getId(), t);
        }

        return new ArrayList<>(tripMap.values())
                .stream()
                .sorted((a, b) -> b.getStartDate().compareTo(a.getStartDate()))
                .map(TripResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TripResponse getTripById(Long tripId, Long userId) {

        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip not found"));

        // Verify user has view access (Owner or active Member)
        verifyUserCanView(trip, userId);

        return TripResponse.from(trip);
    }

    @Transactional
    public TripResponse updateTrip(Long tripId, Long userId, UpdateTripRequest request) {

        validateDates(request.startDate(), request.endDate());

        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip not found"));

        // Verify user has edit access (Owner or active Editor)
        verifyUserCanEdit(trip, userId);

        trip.setName(request.name().trim());
        trip.setDestination(request.destination().trim());
        trip.setTripType(request.tripType());
        trip.setStartDate(request.startDate());
        trip.setEndDate(request.endDate());
        trip.setTravelerCount(request.travelerCount() != null ? request.travelerCount() : 1);
        trip.setBudget(request.budget() != null ? request.budget() : BigDecimal.ZERO);
        trip.setDescription(request.description());
        trip.setCoverImageUrl(request.coverImageUrl());

        if (request.status() != null) {
            trip.setStatus(request.status());
        } else {
            trip.setStatus(calculateStatus(request.startDate(), request.endDate()));
        }

        Trip updatedTrip = tripRepository.save(trip);

        // Audit Log
        auditLogService.log(userId, updatedTrip.getId(), AuditAction.TRIP_UPDATED, "TRIP", updatedTrip.getId(), "Updated trip: " + updatedTrip.getName());

        return TripResponse.from(updatedTrip);
    }

    @Transactional
    public void deleteTrip(Long tripId, Long userId) {

        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip not found"));

        // Only Owner can delete trip (PRD Section 7 & 14)
        if (!trip.getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Only the trip owner can delete this trip");
        }

        tripRepository.delete(trip);

        // Audit Log
        auditLogService.log(userId, tripId, AuditAction.TRIP_DELETED, "TRIP", tripId, "Deleted trip: " + trip.getName());
    }

    private void validateDates(LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "End date cannot be before start date");
        }
    }

    private TripStatus calculateStatus(LocalDate startDate, LocalDate endDate) {
        LocalDate today = LocalDate.now();

        if (today.isBefore(startDate)) {
            return TripStatus.UPCOMING;
        } else if (today.isAfter(endDate)) {
            return TripStatus.COMPLETED;
        } else {
            return TripStatus.ONGOING;
        }
    }

    private void verifyUserCanView(Trip trip, Long userId) {
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

    private void verifyUserCanEdit(Trip trip, Long userId) {
        if (trip.getOwner().getId().equals(userId)) {
            return;
        }
        var memberOpt = tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(
                trip.getId(), userId, MemberStatus.ACTIVE);

        if (memberOpt.isEmpty() || memberOpt.get().getRole() == TripRole.VIEWER) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "You do not have edit permission for this trip");
        }
    }
}

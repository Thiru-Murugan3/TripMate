package com.tripmate.place;

import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PlaceService {

    private final PlaceRepository placeRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    @Transactional(readOnly = true)
    public List<PlaceResponse> getPlaces(Long tripId, Long userId) {

        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        return placeRepository.findByTripIdOrderByIdAsc(tripId)
                .stream()
                .map(PlaceResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PlaceResponse getPlaceById(Long tripId, Long placeId, Long userId) {

        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        Place place = placeRepository.findByIdAndTripId(placeId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Place not found"));

        return PlaceResponse.from(place);
    }

    @Transactional
    public PlaceResponse createPlace(Long tripId, Long userId, CreatePlaceRequest request) {

        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        Place place = Place.builder()
                .trip(trip)
                .name(request.name().trim())
                .category(request.category())
                .latitude(request.latitude())
                .longitude(request.longitude())
                .estimatedCost(request.estimatedCost() != null ? request.estimatedCost() : BigDecimal.ZERO)
                .notes(request.notes())
                .build();

        Place saved = placeRepository.save(place);
        return PlaceResponse.from(saved);
    }

    @Transactional
    public PlaceResponse updatePlace(Long tripId, Long placeId, Long userId, UpdatePlaceRequest request) {

        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        Place place = placeRepository.findByIdAndTripId(placeId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Place not found"));

        place.setName(request.name().trim());
        place.setCategory(request.category());
        place.setLatitude(request.latitude());
        place.setLongitude(request.longitude());
        place.setEstimatedCost(request.estimatedCost() != null ? request.estimatedCost() : BigDecimal.ZERO);
        place.setNotes(request.notes());

        Place updated = placeRepository.save(place);
        return PlaceResponse.from(updated);
    }

    @Transactional
    public void deletePlace(Long tripId, Long placeId, Long userId) {

        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        Place place = placeRepository.findByIdAndTripId(placeId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Place not found"));

        placeRepository.delete(place);
    }

    private Trip findTripOrThrow(Long tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip not found"));
    }

    private void verifyCanView(Trip trip, Long userId) {
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

    private void verifyCanEdit(Trip trip, Long userId) {
        if (trip.getOwner().getId().equals(userId)) {
            return;
        }
        var memberOpt = tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(
                trip.getId(), userId, MemberStatus.ACTIVE);

        if (memberOpt.isEmpty() || memberOpt.get().getRole() == TripRole.VIEWER) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "You do not have permission to edit places for this trip");
        }
    }
}

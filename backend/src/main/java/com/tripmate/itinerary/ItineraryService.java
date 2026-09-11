package com.tripmate.itinerary;

import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.place.Place;
import com.tripmate.place.PlaceRepository;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ItineraryService {

    private final ItineraryDayRepository itineraryDayRepository;
    private final ItineraryItemRepository itineraryItemRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final PlaceRepository placeRepository;

    // 1. POST /api/v1/trips/{tripId}/itinerary/days
    @Transactional
    public ItineraryDayResponse createDay(Long tripId, Long userId, CreateItineraryDayRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        if (itineraryDayRepository.existsByTripIdAndDayNumber(tripId, request.dayNumber())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Day " + request.dayNumber() + " already exists for this trip");
        }

        ItineraryDay day = ItineraryDay.builder()
                .trip(trip)
                .dayNumber(request.dayNumber())
                .dayDate(request.dayDate())
                .title(request.title() != null ? request.title().trim() : null)
                .notes(request.notes())
                .build();

        ItineraryDay saved = itineraryDayRepository.save(day);
        return ItineraryDayResponse.from(saved);
    }

    // 2. GET /api/v1/trips/{tripId}/itinerary
    @Transactional(readOnly = true)
    public TripItineraryResponse getTripItinerary(Long tripId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        List<ItineraryDayResponse> dayResponses = itineraryDayRepository.findByTripIdOrderByDayNumberAsc(tripId)
                .stream()
                .map(ItineraryDayResponse::from)
                .toList();

        return TripItineraryResponse.from(tripId, dayResponses);
    }

    // 3. PUT /api/v1/trips/{tripId}/itinerary/days/{dayId}
    @Transactional
    public ItineraryDayResponse updateDay(Long tripId, Long dayId, Long userId, UpdateItineraryDayRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        ItineraryDay day = findDayOrThrow(tripId, dayId);

        if (!day.getDayNumber().equals(request.dayNumber())
                && itineraryDayRepository.existsByTripIdAndDayNumber(tripId, request.dayNumber())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Day " + request.dayNumber() + " already exists for this trip");
        }

        day.setDayNumber(request.dayNumber());
        day.setDayDate(request.dayDate());
        day.setTitle(request.title() != null ? request.title().trim() : null);
        day.setNotes(request.notes());

        ItineraryDay updated = itineraryDayRepository.save(day);
        return ItineraryDayResponse.from(updated);
    }

    // 4. DELETE /api/v1/trips/{tripId}/itinerary/days/{dayId}
    @Transactional
    public void deleteDay(Long tripId, Long dayId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        ItineraryDay day = findDayOrThrow(tripId, dayId);
        itineraryDayRepository.delete(day);
    }

    // 5. POST /api/v1/trips/{tripId}/itinerary/days/{dayId}/items
    @Transactional
    public ItineraryItemResponse createItem(Long tripId, Long dayId, Long userId, CreateItineraryItemRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        ItineraryDay day = findDayOrThrow(tripId, dayId);
        validateTimes(request.startTime(), request.endTime());

        Place place = null;
        if (request.placeId() != null) {
            place = placeRepository.findByIdAndTripId(request.placeId(), tripId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Place not found in this trip"));
        }

        ItineraryItem item = ItineraryItem.builder()
                .itineraryDay(day)
                .trip(trip)
                .place(place)
                .title(request.title().trim())
                .description(request.description())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .location(request.location() != null ? request.location().trim() : null)
                .estimatedCost(request.estimatedCost() != null ? request.estimatedCost() : BigDecimal.ZERO)
                .displayOrder(request.displayOrder() != null ? request.displayOrder() : 0)
                .build();

        ItineraryItem saved = itineraryItemRepository.save(item);
        return ItineraryItemResponse.from(saved);
    }

    // 6. PUT /api/v1/trips/{tripId}/itinerary/items/{itemId}
    @Transactional
    public ItineraryItemResponse updateItem(Long tripId, Long itemId, Long userId, UpdateItineraryItemRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        ItineraryItem item = findItemOrThrow(tripId, itemId);
        validateTimes(request.startTime(), request.endTime());

        Place place = null;
        if (request.placeId() != null) {
            place = placeRepository.findByIdAndTripId(request.placeId(), tripId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Place not found in this trip"));
        }

        item.setPlace(place);
        item.setTitle(request.title().trim());
        item.setDescription(request.description());
        item.setStartTime(request.startTime());
        item.setEndTime(request.endTime());
        item.setLocation(request.location() != null ? request.location().trim() : null);
        item.setEstimatedCost(request.estimatedCost() != null ? request.estimatedCost() : BigDecimal.ZERO);
        if (request.displayOrder() != null) {
            item.setDisplayOrder(request.displayOrder());
        }

        ItineraryItem updated = itineraryItemRepository.save(item);
        return ItineraryItemResponse.from(updated);
    }

    // 7. DELETE /api/v1/trips/{tripId}/itinerary/items/{itemId}
    @Transactional
    public void deleteItem(Long tripId, Long itemId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        ItineraryItem item = findItemOrThrow(tripId, itemId);
        itineraryItemRepository.delete(item);
    }

    // 8. PUT /api/v1/trips/{tripId}/itinerary/reorder
    @Transactional
    public TripItineraryResponse reorderItinerary(Long tripId, Long userId, ReorderItineraryRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        for (ReorderItineraryRequest.ItemOrder order : request.items()) {
            ItineraryItem item = itineraryItemRepository.findByIdAndTripId(order.itemId(), tripId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND, "Itinerary item not found: " + order.itemId()));
            item.setDisplayOrder(order.displayOrder());
            itineraryItemRepository.save(item);
        }

        return getTripItinerary(tripId, userId);
    }

    private void validateTimes(LocalTime start, LocalTime end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "End time cannot be before start time");
        }
    }

    private Trip findTripOrThrow(Long tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip not found"));
    }

    private ItineraryDay findDayOrThrow(Long tripId, Long dayId) {
        return itineraryDayRepository.findByIdAndTripId(dayId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Itinerary day not found"));
    }

    private ItineraryItem findItemOrThrow(Long tripId, Long itemId) {
        return itineraryItemRepository.findByIdAndTripId(itemId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Itinerary item not found"));
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
                    HttpStatus.FORBIDDEN, "You do not have permission to edit the itinerary for this trip");
        }
    }
}

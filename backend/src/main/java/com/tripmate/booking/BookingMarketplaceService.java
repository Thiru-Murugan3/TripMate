package com.tripmate.booking;

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

@Service
@RequiredArgsConstructor
public class BookingMarketplaceService {

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final BookingRepository bookingRepository;
    private final BookingProvider bookingProvider;

    @Transactional(readOnly = true)
    public BookingSearchResponse search(Long tripId, Long userId, SearchBookingRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);
        validateSearchDates(request);

        return bookingProvider.search(request);
    }

    @Transactional
    public BookNowResponse bookNow(Long tripId, Long userId, BookNowRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        validateTravelerContacts(request);

        ProviderBookingResult providerResult = bookingProvider.book(request);
        BookingOfferResponse offer = providerResult.offer();
        BookingTravelerRequest primaryTraveler = request.travelers().get(0);

        Booking booking = Booking.builder()
                .trip(trip)
                .bookingType(offer.bookingType())
                .transportType(offer.transportType())
                .providerName(offer.providerName())
                .bookingReference(providerResult.bookingReference())
                .departure(offer.departure())
                .arrival(offer.arrival())
                .startDatetime(offer.startDatetime())
                .endDatetime(offer.endDatetime())
                .amount(offer.amount())
                .status(BookingStatus.CONFIRMED)
                .notes("Booked inside TripMate using " + request.paymentMethod())
                .bookingSource(BookingSource.TRIPMATE_SANDBOX)
                .paymentStatus(providerResult.paymentStatus())
                .currency(offer.currency())
                .providerOfferId(offer.offerId())
                .refundable(offer.refundable())
                .travelerName(primaryTraveler.fullName().trim())
                .travelerEmail(primaryTraveler.email().trim().toLowerCase())
                .travelerMobile(normalizeNullable(primaryTraveler.mobile()))
                .build();

        for (int index = 0; index < request.travelers().size(); index++) {
            BookingTravelerRequest travelerRequest = request.travelers().get(index);
            BookingTraveler traveler = BookingTraveler.builder()
                    .booking(booking)
                    .travelerOrder(index + 1)
                    .fullName(travelerRequest.fullName().trim())
                    .gender(travelerRequest.gender())
                    .dateOfBirth(travelerRequest.dateOfBirth())
                    .email(normalizeEmail(travelerRequest.email()))
                    .mobile(normalizeNullable(travelerRequest.mobile()))
                    .build();
            booking.getTravelers().add(traveler);
        }

        Booking saved = bookingRepository.save(booking);

        return new BookNowResponse(
                BookingResponse.from(saved),
                "SANDBOX",
                false,
                providerResult.paymentStatus(),
                providerResult.message()
        );
    }

    private void validateSearchDates(SearchBookingRequest request) {
        if (request.endDate() != null && request.endDate().isBefore(request.startDate())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "End date cannot be before start date"
            );
        }
    }

    private Trip findTripOrThrow(Long tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));
    }

    private void verifyCanEdit(Trip trip, Long userId) {
        if (trip.getOwner().getId().equals(userId)) {
            return;
        }

        var member = tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(
                trip.getId(), userId, MemberStatus.ACTIVE
        );

        if (member.isEmpty() || member.get().getRole() == TripRole.VIEWER) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to book for this trip"
            );
        }
    }

    private void validateTravelerContacts(BookNowRequest request) {
        BookingTravelerRequest primaryTraveler = request.travelers().get(0);
        if (primaryTraveler.email() == null || primaryTraveler.email().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Primary traveler email is required"
            );
        }
        if (primaryTraveler.mobile() == null || primaryTraveler.mobile().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Primary traveler mobile is required"
            );
        }
    }

    private String normalizeEmail(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase();
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

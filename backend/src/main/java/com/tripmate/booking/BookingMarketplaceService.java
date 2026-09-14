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

        ProviderBookingResult providerResult = bookingProvider.book(request);
        BookingOfferResponse offer = providerResult.offer();

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
                .travelerName(request.travelerName().trim())
                .travelerEmail(request.travelerEmail().trim().toLowerCase())
                .travelerMobile(normalizeNullable(request.travelerMobile()))
                .build();

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

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

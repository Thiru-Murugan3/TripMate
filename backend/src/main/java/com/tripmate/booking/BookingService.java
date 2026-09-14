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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    @Transactional(readOnly = true)
    public List<BookingResponse> getBookings(Long tripId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        return bookingRepository.findByTripIdOrderByStartDatetimeAscIdDesc(tripId)
                .stream()
                .map(BookingResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingById(Long tripId, Long bookingId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        Booking booking = bookingRepository.findByIdAndTripId(bookingId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Booking not found in this trip"));

        return BookingResponse.from(booking);
    }

    @Transactional
    public BookingResponse createBooking(Long tripId, Long userId, CreateBookingRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        validateAmount(request.amount());
        validateDatetimes(request.startDatetime(), request.endDatetime());
        validateTransportType(request.bookingType(), request.transportType());
        validateDepartureAndArrival(request.bookingType(), request.departure(), request.arrival());

        Booking booking = Booking.builder()
                .trip(trip)
                .bookingType(request.bookingType())
                .transportType(request.transportType())
                .providerName(request.providerName().trim())
                .bookingReference(request.bookingReference() != null ? request.bookingReference().trim() : null)
                .departure(request.departure() != null ? request.departure().trim() : null)
                .arrival(request.arrival() != null ? request.arrival().trim() : null)
                .startDatetime(request.startDatetime())
                .endDatetime(request.endDatetime())
                .amount(request.amount() != null ? request.amount() : BigDecimal.ZERO)
                .status(request.status() != null ? request.status() : BookingStatus.CONFIRMED)
                .notes(request.notes())
                .bookingSource(BookingSource.EXTERNAL_MANUAL)
                .paymentStatus(PaymentStatus.NOT_REQUIRED)
                .currency("INR")
                .build();

        Booking saved = bookingRepository.save(booking);
        return BookingResponse.from(saved);
    }

    @Transactional
    public BookingResponse updateBooking(Long tripId, Long bookingId, Long userId, UpdateBookingRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        validateAmount(request.amount());
        validateDatetimes(request.startDatetime(), request.endDatetime());
        validateTransportType(request.bookingType(), request.transportType());
        validateDepartureAndArrival(request.bookingType(), request.departure(), request.arrival());

        Booking booking = bookingRepository.findByIdAndTripId(bookingId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Booking not found in this trip"));

        booking.setBookingType(request.bookingType());
        booking.setTransportType(request.transportType());
        booking.setProviderName(request.providerName().trim());
        booking.setBookingReference(request.bookingReference() != null ? request.bookingReference().trim() : null);
        booking.setDeparture(request.departure() != null ? request.departure().trim() : null);
        booking.setArrival(request.arrival() != null ? request.arrival().trim() : null);
        booking.setStartDatetime(request.startDatetime());
        booking.setEndDatetime(request.endDatetime());
        booking.setAmount(request.amount() != null ? request.amount() : BigDecimal.ZERO);
        if (request.status() != null) {
            booking.setStatus(request.status());
        }
        booking.setNotes(request.notes());

        Booking updated = bookingRepository.save(booking);
        return BookingResponse.from(updated);
    }

    @Transactional
    public CancelBookingResponse cancelBooking(
            Long tripId,
            Long bookingId,
            Long userId,
            CancelBookingRequest request
    ) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        Booking booking = bookingRepository.findByIdAndTripId(bookingId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Booking not found in this trip"));

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Booking is already cancelled");
        }

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Completed bookings cannot be cancelled");
        }

        if (booking.getStartDatetime() != null
                && booking.getStartDatetime().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Booking cannot be cancelled after the journey or activity has started");
        }

        if (booking.getBookingSource() == BookingSource.TRIPMATE_PROVIDER) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_IMPLEMENTED,
                    "Live provider cancellation is not configured yet");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(normalizeCancellationReason(request.reason()));
        booking.setCancelledAt(LocalDateTime.now());

        String message = "Booking cancelled successfully.";

        if (booking.getBookingSource() == BookingSource.TRIPMATE_SANDBOX
                && booking.getPaymentStatus() == PaymentStatus.PAID) {
            if (Boolean.TRUE.equals(booking.getRefundable())) {
                booking.setPaymentStatus(PaymentStatus.REFUNDED);
                message = "Booking cancelled successfully. Sandbox refund completed.";
            } else {
                message = "Booking cancelled successfully. This sandbox fare is non-refundable.";
            }
        }

        Booking cancelled = bookingRepository.save(booking);
        return new CancelBookingResponse(BookingResponse.from(cancelled), message);
    }

    @Transactional
    public void deleteBooking(Long tripId, Long bookingId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        Booking booking = bookingRepository.findByIdAndTripId(bookingId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Booking not found in this trip"));

        bookingRepository.delete(booking);
    }

    private String normalizeCancellationReason(String reason) {
        return reason == null || reason.isBlank() ? null : reason.trim();
    }

    private void validateTransportType(BookingType bookingType, TransportType transportType) {
        if (bookingType == BookingType.TRANSPORT) {
            if (transportType == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Transport type is required for TRANSPORT bookings");
            }
        } else {
            if (transportType != null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Transport type must be null for " + bookingType + " bookings");
            }
        }
    }

    private void validateDepartureAndArrival(BookingType bookingType, String departure, String arrival) {
        if (bookingType == BookingType.TRANSPORT) {
            if (departure == null || departure.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Departure location is required for TRANSPORT bookings");
            }
            if (arrival == null || arrival.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Arrival location is required for TRANSPORT bookings");
            }
        } else {
            if (departure != null || arrival != null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Departure and arrival locations must be null for " + bookingType + " bookings");
            }
        }
    }

    private void validateAmount(BigDecimal amount) {
        if (amount != null && amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Amount must be greater than or equal to 0");
        }
    }

    private void validateDatetimes(LocalDateTime start, LocalDateTime end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "End date/time cannot be before start date/time");
        }
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
                    HttpStatus.FORBIDDEN, "You do not have permission to edit bookings for this trip");
        }
    }
}

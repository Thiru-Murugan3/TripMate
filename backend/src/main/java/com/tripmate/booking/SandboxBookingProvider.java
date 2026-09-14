package com.tripmate.booking;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SandboxBookingProvider implements BookingProvider {

    private static final String DISCLAIMER =
            "Sandbox booking mode is active. Search results, payments, PNRs and tickets are simulated and do not create a real provider booking.";

    private final Map<String, BookingOfferResponse> offers = new ConcurrentHashMap<>();

    @Override
    public BookingSearchResponse search(SearchBookingRequest request) {
        List<BookingOfferResponse> results = switch (request.bookingType()) {
            case HOTEL -> hotelOffers(request);
            case ACTIVITY -> activityOffers(request);
            case TRANSPORT -> transportOffers(request);
        };

        for (BookingOfferResponse offer : results) {
            offers.put(offer.offerId(), offer);
        }

        return new BookingSearchResponse(
                "SANDBOX",
                false,
                DISCLAIMER,
                results
        );
    }

    @Override
    public ProviderBookingResult book(BookNowRequest request) {
        BookingOfferResponse offer = offers.get(request.offerId());
        if (offer == null) {
            throw new ResponseStatusException(
                    HttpStatus.GONE,
                    "This booking offer has expired. Search again to get a fresh offer."
            );
        }

        String reference = "TM-SBX-" + UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, 10)
                .toUpperCase();

        return new ProviderBookingResult(
                offer,
                reference,
                PaymentStatus.PAID,
                "Sandbox booking confirmed. No real money was charged and no external provider ticket was issued."
        );
    }

    private List<BookingOfferResponse> transportOffers(SearchBookingRequest request) {
        if (request.transportType() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Transport type is required for transport search"
            );
        }
        if (request.origin() == null || request.origin().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Origin is required");
        }
        if (request.destination() == null || request.destination().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination is required");
        }

        int travelers = request.travelers() != null ? request.travelers() : 1;
        List<BookingOfferResponse> results = new ArrayList<>();

        if (request.transportType() == TransportType.FLIGHT) {
            results.add(offer(request, "TripMate Air Sandbox", "Economy Flex",
                    LocalTime.of(6, 30), LocalTime.of(8, 0), new BigDecimal("5450"), travelers, true));
            results.add(offer(request, "TripMate Air Sandbox", "Economy Saver",
                    LocalTime.of(11, 15), LocalTime.of(12, 50), new BigDecimal("4690"), travelers, false));
            results.add(offer(request, "TripMate Air Sandbox", "Evening Economy",
                    LocalTime.of(18, 5), LocalTime.of(19, 40), new BigDecimal("5120"), travelers, true));
        } else if (request.transportType() == TransportType.TRAIN) {
            results.add(offer(request, "TripMate Rail Sandbox", "AC 3 Tier",
                    LocalTime.of(20, 30), LocalTime.of(6, 30), new BigDecimal("1250"), travelers, true));
            results.add(offer(request, "TripMate Rail Sandbox", "AC Chair Car",
                    LocalTime.of(7, 0), LocalTime.of(14, 0), new BigDecimal("980"), travelers, false));
        } else if (request.transportType() == TransportType.BUS) {
            results.add(offer(request, "TripMate Bus Sandbox", "AC Sleeper",
                    LocalTime.of(21, 0), LocalTime.of(6, 0), new BigDecimal("1150"), travelers, true));
            results.add(offer(request, "TripMate Bus Sandbox", "AC Seater",
                    LocalTime.of(8, 0), LocalTime.of(16, 0), new BigDecimal("850"), travelers, false));
        } else {
            results.add(offer(request, "TripMate Transport Sandbox", request.transportType().name(),
                    LocalTime.of(9, 0), LocalTime.of(12, 0), new BigDecimal("1500"), travelers, true));
        }

        return results;
    }

    private BookingOfferResponse offer(
            SearchBookingRequest request,
            String provider,
            String title,
            LocalTime departureTime,
            LocalTime arrivalTime,
            BigDecimal perTraveler,
            int travelers,
            boolean refundable
    ) {
        LocalDateTime start = LocalDateTime.of(request.startDate(), departureTime);
        LocalDateTime end = LocalDateTime.of(
                arrivalTime.isBefore(departureTime) ? request.startDate().plusDays(1) : request.startDate(),
                arrivalTime
        );

        return new BookingOfferResponse(
                UUID.randomUUID().toString(),
                BookingType.TRANSPORT,
                request.transportType(),
                provider,
                title,
                request.origin().trim(),
                request.destination().trim(),
                start,
                end,
                perTraveler.multiply(BigDecimal.valueOf(travelers)),
                "INR",
                refundable
        );
    }

    private List<BookingOfferResponse> hotelOffers(SearchBookingRequest request) {
        if (request.destination() == null || request.destination().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination is required");
        }
        if (request.endDate() == null || request.endDate().isBefore(request.startDate())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Hotel check-out date must be on or after check-in date"
            );
        }

        long nights = Math.max(1, java.time.temporal.ChronoUnit.DAYS.between(
                request.startDate(), request.endDate()
        ));
        int roomsFactor = Math.max(1, (request.travelers() != null ? request.travelers() : 1 + 1) / 2);

        return List.of(
                hotelOffer(request, "TripMate Stay Sandbox", "Comfort Room",
                        new BigDecimal("2800"), nights, roomsFactor, true),
                hotelOffer(request, "TripMate Stay Sandbox", "Premium Room",
                        new BigDecimal("4200"), nights, roomsFactor, true),
                hotelOffer(request, "TripMate Stay Sandbox", "Budget Room",
                        new BigDecimal("1900"), nights, roomsFactor, false)
        );
    }

    private BookingOfferResponse hotelOffer(
            SearchBookingRequest request,
            String provider,
            String title,
            BigDecimal nightlyRate,
            long nights,
            int roomsFactor,
            boolean refundable
    ) {
        return new BookingOfferResponse(
                UUID.randomUUID().toString(),
                BookingType.HOTEL,
                null,
                provider,
                title + " · " + request.destination().trim(),
                null,
                request.destination().trim(),
                LocalDateTime.of(request.startDate(), LocalTime.of(14, 0)),
                LocalDateTime.of(request.endDate(), LocalTime.of(11, 0)),
                nightlyRate
                        .multiply(BigDecimal.valueOf(nights))
                        .multiply(BigDecimal.valueOf(roomsFactor)),
                "INR",
                refundable
        );
    }

    private List<BookingOfferResponse> activityOffers(SearchBookingRequest request) {
        if (request.destination() == null || request.destination().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination is required");
        }

        int travelers = request.travelers() != null ? request.travelers() : 1;
        return List.of(
                activityOffer(request, "TripMate Activities Sandbox", "City Highlights Experience",
                        new BigDecimal("750"), travelers, true),
                activityOffer(request, "TripMate Activities Sandbox", "Adventure Experience",
                        new BigDecimal("1250"), travelers, false)
        );
    }

    private BookingOfferResponse activityOffer(
            SearchBookingRequest request,
            String provider,
            String title,
            BigDecimal perTraveler,
            int travelers,
            boolean refundable
    ) {
        return new BookingOfferResponse(
                UUID.randomUUID().toString(),
                BookingType.ACTIVITY,
                null,
                provider,
                title + " · " + request.destination().trim(),
                null,
                request.destination().trim(),
                LocalDateTime.of(request.startDate(), LocalTime.of(10, 0)),
                LocalDateTime.of(request.startDate(), LocalTime.of(13, 0)),
                perTraveler.multiply(BigDecimal.valueOf(travelers)),
                "INR",
                refundable
        );
    }
}

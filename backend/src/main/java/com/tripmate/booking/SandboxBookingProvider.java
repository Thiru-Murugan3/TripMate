package com.tripmate.booking;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SandboxBookingProvider implements BookingProvider {

    private static final String DISCLAIMER =
            "Sandbox mode: results are simulated for development. Real availability, fares, PNRs and payments require licensed travel-provider integrations.";

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
        validateTransportSearch(request);
        int travelers = request.travelers() != null ? request.travelers() : 1;

        return switch (request.transportType()) {
            case FLIGHT -> flightOffers(request, travelers);
            case TRAIN -> trainOffers(request, travelers);
            case BUS -> busOffers(request, travelers);
            default -> genericTransportOffers(request, travelers);
        };
    }

    private List<BookingOfferResponse> flightOffers(SearchBookingRequest request, int travelers) {
        return List.of(
                transportOffer(request, "SkyJet Sandbox", "Economy Saver", LocalTime.of(5, 45), 95,
                        new BigDecimal("4390"), travelers, false, 0, "ECONOMY", 7,
                        List.of("Cabin baggage")),
                transportOffer(request, "AirVista Sandbox", "Economy Flex", LocalTime.of(6, 30), 90,
                        new BigDecimal("5250"), travelers, true, 0, "ECONOMY", 5,
                        List.of("Cabin baggage", "Date change")),
                transportOffer(request, "BlueWing Sandbox", "Economy", LocalTime.of(7, 50), 100,
                        new BigDecimal("4780"), travelers, false, 0, "ECONOMY", 9,
                        List.of("Cabin baggage")),
                transportOffer(request, "SkyJet Sandbox", "Economy Flex", LocalTime.of(9, 15), 105,
                        new BigDecimal("5680"), travelers, true, 0, "ECONOMY", 4,
                        List.of("Meal", "Date change")),
                transportOffer(request, "AirVista Sandbox", "Premium Economy", LocalTime.of(11, 20), 110,
                        new BigDecimal("6890"), travelers, true, 0, "PREMIUM_ECONOMY", 3,
                        List.of("Meal", "Priority boarding")),
                transportOffer(request, "CloudAir Sandbox", "Economy Saver", LocalTime.of(13, 10), 165,
                        new BigDecimal("4210"), travelers, false, 1, "ECONOMY", 8,
                        List.of("Cabin baggage")),
                transportOffer(request, "BlueWing Sandbox", "Economy Flex", LocalTime.of(15, 40), 95,
                        new BigDecimal("5390"), travelers, true, 0, "ECONOMY", 6,
                        List.of("Date change")),
                transportOffer(request, "CloudAir Sandbox", "Economy", LocalTime.of(17, 25), 170,
                        new BigDecimal("4520"), travelers, false, 1, "ECONOMY", 11,
                        List.of("Cabin baggage")),
                transportOffer(request, "AirVista Sandbox", "Business", LocalTime.of(19, 10), 90,
                        new BigDecimal("12490"), travelers, true, 0, "BUSINESS", 2,
                        List.of("Lounge", "Meal", "Priority boarding")),
                transportOffer(request, "SkyJet Sandbox", "Late Economy", LocalTime.of(21, 30), 100,
                        new BigDecimal("4590"), travelers, false, 0, "ECONOMY", 10,
                        List.of("Cabin baggage"))
        );
    }

    private List<BookingOfferResponse> trainOffers(SearchBookingRequest request, int travelers) {
        return List.of(
                transportOffer(request, "Rail Express Sandbox", "Morning Intercity", LocalTime.of(5, 55), 390,
                        new BigDecimal("780"), travelers, false, 0, "CC", 42,
                        List.of("Reserved seat")),
                transportOffer(request, "Rail Connect Sandbox", "Superfast Express", LocalTime.of(7, 20), 430,
                        new BigDecimal("1250"), travelers, true, 0, "3A", 28,
                        List.of("AC coach", "Berth")),
                transportOffer(request, "Rail Express Sandbox", "Day Express", LocalTime.of(9, 45), 455,
                        new BigDecimal("520"), travelers, false, 0, "SL", 61,
                        List.of("Sleeper berth")),
                transportOffer(request, "Rail Premium Sandbox", "Premium Express", LocalTime.of(12, 10), 375,
                        new BigDecimal("1850"), travelers, true, 0, "2A", 18,
                        List.of("AC coach", "Bedding")),
                transportOffer(request, "Rail Connect Sandbox", "Afternoon Express", LocalTime.of(14, 35), 470,
                        new BigDecimal("980"), travelers, true, 0, "3A", 33,
                        List.of("AC coach")),
                transportOffer(request, "Rail Night Sandbox", "Night Sleeper", LocalTime.of(18, 40), 600,
                        new BigDecimal("610"), travelers, false, 0, "SL", 74,
                        List.of("Sleeper berth")),
                transportOffer(request, "Rail Premium Sandbox", "Night AC Express", LocalTime.of(20, 30), 560,
                        new BigDecimal("2160"), travelers, true, 0, "2A", 14,
                        List.of("AC coach", "Bedding")),
                transportOffer(request, "Rail Executive Sandbox", "Executive Chair", LocalTime.of(6, 45), 350,
                        new BigDecimal("2450"), travelers, true, 0, "EC", 9,
                        List.of("Meal", "Executive seat"))
        );
    }

    private List<BookingOfferResponse> busOffers(SearchBookingRequest request, int travelers) {
        return List.of(
                transportOffer(request, "GreenLine Sandbox", "AC Sleeper 2+1", LocalTime.of(6, 0), 480,
                        new BigDecimal("1150"), travelers, true, 0, "AC_SLEEPER", 12,
                        List.of("Charging point", "Blanket")),
                transportOffer(request, "CityRide Sandbox", "AC Seater 2+2", LocalTime.of(7, 30), 510,
                        new BigDecimal("780"), travelers, false, 0, "AC_SEATER", 18,
                        List.of("Charging point")),
                transportOffer(request, "RoyalBus Sandbox", "Volvo AC Multi-Axle", LocalTime.of(9, 0), 450,
                        new BigDecimal("1320"), travelers, true, 0, "VOLVO_AC", 8,
                        List.of("Water bottle", "Charging point")),
                transportOffer(request, "GreenLine Sandbox", "Non-AC Sleeper", LocalTime.of(11, 15), 520,
                        new BigDecimal("690"), travelers, false, 0, "NON_AC_SLEEPER", 20,
                        List.of("Blanket")),
                transportOffer(request, "TravelStar Sandbox", "AC Sleeper", LocalTime.of(13, 45), 490,
                        new BigDecimal("1090"), travelers, true, 0, "AC_SLEEPER", 14,
                        List.of("Charging point", "Reading light")),
                transportOffer(request, "CityRide Sandbox", "AC Seater", LocalTime.of(16, 0), 500,
                        new BigDecimal("820"), travelers, false, 0, "AC_SEATER", 23,
                        List.of("Charging point")),
                transportOffer(request, "NightGo Sandbox", "AC Sleeper 2+1", LocalTime.of(20, 0), 470,
                        new BigDecimal("1280"), travelers, true, 0, "AC_SLEEPER", 7,
                        List.of("Blanket", "Water bottle")),
                transportOffer(request, "RoyalBus Sandbox", "Volvo Sleeper", LocalTime.of(21, 15), 455,
                        new BigDecimal("1490"), travelers, true, 0, "VOLVO_SLEEPER", 5,
                        List.of("Blanket", "Charging point", "Water bottle")),
                transportOffer(request, "TravelStar Sandbox", "Non-AC Seater", LocalTime.of(22, 0), 530,
                        new BigDecimal("590"), travelers, false, 0, "NON_AC_SEATER", 31,
                        List.of()),
                transportOffer(request, "NightGo Sandbox", "AC Sleeper", LocalTime.of(23, 0), 460,
                        new BigDecimal("1190"), travelers, false, 0, "AC_SLEEPER", 10,
                        List.of("Charging point"))
        );
    }

    private List<BookingOfferResponse> genericTransportOffers(SearchBookingRequest request, int travelers) {
        return List.of(
                transportOffer(request, "TripMate Transport Sandbox", request.transportType().name(),
                        LocalTime.of(9, 0), 180, new BigDecimal("1500"), travelers,
                        true, 0, request.transportType().name(), 6, List.of())
        );
    }

    private BookingOfferResponse transportOffer(
            SearchBookingRequest request,
            String provider,
            String title,
            LocalTime departureTime,
            int durationMinutes,
            BigDecimal perTraveler,
            int travelers,
            boolean refundable,
            int stops,
            String serviceClass,
            int availableSeats,
            List<String> amenities
    ) {
        LocalDateTime start = LocalDateTime.of(request.startDate(), departureTime);
        LocalDateTime end = start.plusMinutes(durationMinutes);

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
                refundable,
                durationMinutes,
                stops,
                serviceClass,
                availableSeats,
                amenities
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

        long nights = Math.max(1, ChronoUnit.DAYS.between(request.startDate(), request.endDate()));
        int travelers = request.travelers() != null ? request.travelers() : 1;
        int rooms = Math.max(1, (travelers + 1) / 2);

        return List.of(
                hotelOffer(request, "TripMate Stay Sandbox", "Budget Room", new BigDecimal("1900"), nights, rooms, false, "BUDGET", 5),
                hotelOffer(request, "TripMate Stay Sandbox", "Comfort Room", new BigDecimal("2800"), nights, rooms, true, "STANDARD", 8),
                hotelOffer(request, "TripMate Resort Sandbox", "Deluxe Room", new BigDecimal("3600"), nights, rooms, true, "DELUXE", 4),
                hotelOffer(request, "TripMate Resort Sandbox", "Premium Room", new BigDecimal("4200"), nights, rooms, true, "PREMIUM", 3),
                hotelOffer(request, "TripMate Luxury Sandbox", "Suite", new BigDecimal("6800"), nights, rooms, true, "SUITE", 2)
        );
    }

    private BookingOfferResponse hotelOffer(
            SearchBookingRequest request,
            String provider,
            String title,
            BigDecimal nightlyRate,
            long nights,
            int rooms,
            boolean refundable,
            String serviceClass,
            int availableRooms
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
                nightlyRate.multiply(BigDecimal.valueOf(nights)).multiply(BigDecimal.valueOf(rooms)),
                "INR",
                refundable,
                null,
                null,
                serviceClass,
                availableRooms,
                List.of("Wi-Fi", "Front desk")
        );
    }

    private List<BookingOfferResponse> activityOffers(SearchBookingRequest request) {
        if (request.destination() == null || request.destination().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination is required");
        }

        int travelers = request.travelers() != null ? request.travelers() : 1;
        return List.of(
                activityOffer(request, "TripMate Activities Sandbox", "City Highlights Experience", new BigDecimal("750"), travelers, true, "SIGHTSEEING"),
                activityOffer(request, "TripMate Activities Sandbox", "Adventure Experience", new BigDecimal("1250"), travelers, false, "ADVENTURE"),
                activityOffer(request, "TripMate Local Sandbox", "Food & Culture Walk", new BigDecimal("950"), travelers, true, "CULTURE"),
                activityOffer(request, "TripMate Local Sandbox", "Sunset Experience", new BigDecimal("650"), travelers, false, "LEISURE")
        );
    }

    private BookingOfferResponse activityOffer(
            SearchBookingRequest request,
            String provider,
            String title,
            BigDecimal perTraveler,
            int travelers,
            boolean refundable,
            String serviceClass
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
                refundable,
                180,
                0,
                serviceClass,
                20,
                List.of("Mobile voucher")
        );
    }

    private void validateTransportSearch(SearchBookingRequest request) {
        if (request.transportType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transport type is required");
        }
        if (request.origin() == null || request.origin().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Origin is required");
        }
        if (request.destination() == null || request.destination().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination is required");
        }
    }
}

package com.tripmate.timeline;

import com.tripmate.booking.Booking;
import com.tripmate.booking.BookingRepository;
import com.tripmate.booking.BookingType;
import com.tripmate.booking.BookingStatus;
import com.tripmate.booking.TransportType;
import com.tripmate.itinerary.ItineraryDay;
import com.tripmate.itinerary.ItineraryDayRepository;
import com.tripmate.itinerary.ItineraryItem;
import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TimelineService {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy", Locale.ENGLISH);

    private static final Set<String> FOOD_KEYWORDS = Set.of(
            "lunch", "dinner", "breakfast", "brunch", "snack", "food", "restaurant",
            "cafe", "dining", "coffee", "bhojanalaya", "mess", "biryani", "dosa",
            "eatery", "tea", "bakery", "buffet", "meal"
    );

    private static final Set<String> SIGHTSEEING_KEYWORDS = Set.of(
            "temple", "church", "mosque", "museum", "fort", "palace", "beach",
            "falls", "waterfall", "lake", "park", "monument", "market", "shopping",
            "safari", "trek", "sightseeing", "tour", "garden", "zoo", "ashram",
            "sanctuary", "viewpoint", "cave", "heritage"
    );

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final BookingRepository bookingRepository;
    private final ItineraryDayRepository itineraryDayRepository;

    @Transactional(readOnly = true)
    public TripTimelineResponse getTripTimeline(Long tripId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        List<Booking> bookings = bookingRepository.findByTripIdOrderByStartDatetimeAscIdDesc(tripId);
        List<ItineraryDay> itineraryDays = itineraryDayRepository.findByTripIdOrderByDayNumberAsc(tripId);

        // Map all items from Bookings and Itinerary
        List<TimelineItemResponse> allItems = new ArrayList<>();
        allItems.addAll(mapBookingsToTimelineItems(bookings));
        allItems.addAll(mapItineraryToTimelineItems(itineraryDays, trip));

        allItems = detectConflictsAndGaps(allItems);

        // Collect all distinct dates
        SortedSet<LocalDate> dates = new TreeSet<>();
        if (trip.getStartDate() != null && trip.getEndDate() != null) {
            LocalDate curr = trip.getStartDate();
            while (!curr.isAfter(trip.getEndDate())) {
                dates.add(curr);
                curr = curr.plusDays(1);
            }
        }
        for (TimelineItemResponse item : allItems) {
            if (item.startDatetime() != null) {
                dates.add(item.startDatetime().toLocalDate());
            }
        }

        // Group items by date
        Map<LocalDate, List<TimelineItemResponse>> itemsByDate = allItems.stream()
                .filter(i -> i.startDatetime() != null)
                .collect(Collectors.groupingBy(i -> i.startDatetime().toLocalDate()));

        // Lookup maps for itinerary day metadata
        Map<LocalDate, ItineraryDay> itineraryDayMap = new HashMap<>();
        for (ItineraryDay day : itineraryDays) {
            if (day.getDayDate() != null) {
                itineraryDayMap.put(day.getDayDate(), day);
            }
        }

        List<TimelineDayResponse> dayResponses = new ArrayList<>();
        int dayIndex = 1;
        int totalConflicts = 0;
        int transportCount = 0;
        int stayCount = 0;
        int activityCount = 0;
        int mealCount = 0;

        for (LocalDate date : dates) {
            List<TimelineItemResponse> dayItems = itemsByDate.getOrDefault(date, new ArrayList<>());

            // Sort chronologically within the day
            dayItems.sort(Comparator.comparing(TimelineItemResponse::flexible)
                    .thenComparing(TimelineItemResponse::startDatetime));

            // Run smart conflict detection


            boolean dayHasConflict = dayItems.stream().anyMatch(TimelineItemResponse::conflict);
            if (dayHasConflict) {
                totalConflicts += dayItems.stream().filter(TimelineItemResponse::conflict).count();
            }

            for (TimelineItemResponse item : dayItems) {
                switch (item.itemType()) {
                    case TRANSPORT_DEPARTURE, TRANSPORT_ARRIVAL -> transportCount++;
                    case HOTEL_CHECKIN, HOTEL_CHECKOUT -> stayCount++;
                    case MEAL -> mealCount++;
                    case ACTIVITY, OTHER -> activityCount++;
                }
            }

            ItineraryDay itinDay = itineraryDayMap.get(date);
            String title = resolveDayTitle(itinDay, dayItems, dayIndex, trip, date);
            String notes = itinDay != null ? itinDay.getNotes() : null;

            dayResponses.add(TimelineDayResponse.builder()
                    .dayNumber(dayIndex++)
                    .date(date)
                    .formattedDate(date.format(DATE_FORMAT))
                    .title(title)
                    .notes(notes)
                    .hasConflict(dayHasConflict)
                    .items(dayItems)
                    .build());
        }

        return TripTimelineResponse.builder()
                .tripId(trip.getId())
                .tripName(trip.getName())
                .destination(trip.getDestination())
                .startDate(trip.getStartDate())
                .endDate(trip.getEndDate())
                .totalEvents(allItems.size())
                .transportCount(transportCount)
                .stayCount(stayCount)
                .activityCount(activityCount)
                .mealCount(mealCount)
                .conflictCount(totalConflicts)
                .days(dayResponses)
                .build();
    }

    private List<TimelineItemResponse> mapBookingsToTimelineItems(List<Booking> bookings) {
        List<TimelineItemResponse> items = new ArrayList<>();
        for (Booking booking : bookings) {
            if (booking.getStartDatetime() == null || booking.getStatus() == BookingStatus.CANCELLED) continue;

            if (booking.getBookingType() == BookingType.TRANSPORT) {
                TransportType transportType = booking.getTransportType() != null ? booking.getTransportType() : TransportType.OTHER;
                String provider = booking.getProviderName() != null ? booking.getProviderName() : "Transport";
                String ref = booking.getBookingReference();
                String dep = booking.getDeparture() != null ? booking.getDeparture() : "";
                String arr = booking.getArrival() != null ? booking.getArrival() : "";
                String route = (!dep.isBlank() && !arr.isBlank()) ? dep + " → " + arr : (!arr.isBlank() ? "To " + arr : "");

                // 1. Transport Departure Event
                items.add(TimelineItemResponse.builder()
                        .id("booking-dep-" + booking.getId())
                        .sourceType("BOOKING")
                        .sourceId(booking.getId())
                        .itemType(TimelineItemType.TRANSPORT_DEPARTURE)
                        .category(transportType.name())
                        .title(provider + (ref != null && !ref.isBlank() ? " (" + ref + ")" : "") + " Departure")
                        .subtitle(route)
                        .startDatetime(booking.getStartDatetime())
                        .endDatetime(booking.getEndDatetime())
                        .timeFormatted(formatTime(booking.getStartDatetime()))
                        .endTimeFormatted(formatTime(booking.getEndDatetime()))
                        .location(booking.getPickupPoint() != null ? booking.getPickupPoint() : dep)
                        .departure(dep)
                        .arrival(arr)
                        .provider(provider)
                        .bookingReference(ref)
                        .status(booking.getStatus().name())
                        .amount(booking.getAmount())
                        .currency(booking.getCurrency())
                        .notes(booking.getNotes())
                        .icon(getTransportIcon(transportType, true))
                        .badgeColor(getTransportBadgeColor(transportType))
                        .conflict(false)
                        .build());

                // 2. Transport Arrival Event (if arrival time specified)
                if (booking.getEndDatetime() != null && booking.getEndDatetime().isAfter(booking.getStartDatetime())) {
                    items.add(TimelineItemResponse.builder()
                            .id("booking-arr-" + booking.getId())
                            .sourceType("BOOKING")
                            .sourceId(booking.getId())
                            .itemType(TimelineItemType.TRANSPORT_ARRIVAL)
                            .category(transportType.name())
                            .title(provider + " Arrival" + (!arr.isBlank() ? " at " + arr : ""))
                            .subtitle("Arrival: " + (!arr.isBlank() ? arr : "Destination"))
                            .startDatetime(booking.getEndDatetime())
                            .endDatetime(null)
                            .timeFormatted(formatTime(booking.getEndDatetime()))
                            .endTimeFormatted(null)
                            .location(booking.getDropPoint() != null ? booking.getDropPoint() : arr)
                            .departure(dep)
                            .arrival(arr)
                            .provider(provider)
                            .bookingReference(ref)
                            .status(booking.getStatus().name())
                            .amount(null)
                            .currency(booking.getCurrency())
                            .notes(null)
                            .icon(getTransportIcon(transportType, false))
                            .badgeColor("emerald")
                            .conflict(false)
                            .build());
                }
            } else if (booking.getBookingType() == BookingType.HOTEL) {
                String hotelName = booking.getProviderName() != null ? booking.getProviderName() : "Hotel";

                // Hotel Check-in
                items.add(TimelineItemResponse.builder()
                        .id("booking-hotel-in-" + booking.getId())
                        .sourceType("BOOKING")
                        .sourceId(booking.getId())
                        .itemType(TimelineItemType.HOTEL_CHECKIN)
                        .category("HOTEL")
                        .title("Hotel Check-in: " + hotelName)
                        .subtitle(booking.getBookingReference() != null ? "Voucher: " + booking.getBookingReference() : "Confirmed Stay")
                        .startDatetime(booking.getStartDatetime())
                        .endDatetime(booking.getEndDatetime())
                        .timeFormatted(formatTime(booking.getStartDatetime()))
                        .endTimeFormatted(formatTime(booking.getEndDatetime()))
                        .location(booking.getArrival() != null ? booking.getArrival() : hotelName)
                        .departure(null)
                        .arrival(booking.getArrival())
                        .provider(hotelName)
                        .bookingReference(booking.getBookingReference())
                        .status(booking.getStatus().name())
                        .amount(booking.getAmount())
                        .currency(booking.getCurrency())
                        .notes(booking.getNotes())
                        .icon("hotel")
                        .badgeColor("purple")
                        .conflict(false)
                        .build());

                // Hotel Check-out (if end date specified)
                if (booking.getEndDatetime() != null && booking.getEndDatetime().isAfter(booking.getStartDatetime())) {
                    items.add(TimelineItemResponse.builder()
                            .id("booking-hotel-out-" + booking.getId())
                            .sourceType("BOOKING")
                            .sourceId(booking.getId())
                            .itemType(TimelineItemType.HOTEL_CHECKOUT)
                            .category("HOTEL")
                            .title("Hotel Check-out: " + hotelName)
                            .subtitle("Check-out from " + hotelName)
                            .startDatetime(booking.getEndDatetime())
                            .endDatetime(null)
                            .timeFormatted(formatTime(booking.getEndDatetime()))
                            .endTimeFormatted(null)
                            .location(hotelName)
                            .departure(null)
                            .arrival(null)
                            .provider(hotelName)
                            .bookingReference(booking.getBookingReference())
                            .status(booking.getStatus().name())
                            .amount(null)
                            .currency(booking.getCurrency())
                            .notes(null)
                            .icon("hotel")
                            .badgeColor("purple")
                            .conflict(false)
                            .build());
                }
            } else {
                // Generic Activity booking
                items.add(TimelineItemResponse.builder()
                        .id("booking-act-" + booking.getId())
                        .sourceType("BOOKING")
                        .sourceId(booking.getId())
                        .itemType(TimelineItemType.ACTIVITY)
                        .category("ACTIVITY")
                        .title(booking.getProviderName() != null ? booking.getProviderName() : "Activity")
                        .subtitle(booking.getBookingReference())
                        .startDatetime(booking.getStartDatetime())
                        .endDatetime(booking.getEndDatetime())
                        .timeFormatted(formatTime(booking.getStartDatetime()))
                        .endTimeFormatted(formatTime(booking.getEndDatetime()))
                        .location(booking.getDeparture() != null ? booking.getDeparture() : booking.getPickupPoint())
                        .departure(null)
                        .arrival(null)
                        .provider(booking.getProviderName())
                        .bookingReference(booking.getBookingReference())
                        .status(booking.getStatus().name())
                        .amount(booking.getAmount())
                        .currency(booking.getCurrency())
                        .notes(booking.getNotes())
                        .icon("local_activity")
                        .badgeColor("indigo")
                        .conflict(false)
                        .build());
            }
        }
        return items;
    }

    private List<TimelineItemResponse> mapItineraryToTimelineItems(List<ItineraryDay> days, Trip trip) {
        List<TimelineItemResponse> items = new ArrayList<>();
        LocalDate tripStart = trip.getStartDate() != null ? trip.getStartDate() : LocalDate.now();

        for (ItineraryDay day : days) {
            LocalDate date = day.getDayDate() != null
                    ? day.getDayDate()
                    : tripStart.plusDays(Math.max(0, day.getDayNumber() - 1));

            if (day.getItems() == null) continue;

            for (ItineraryItem item : day.getItems()) {
                LocalDateTime start;
                String formattedTime;
                if (item.getStartTime() != null) {
                    start = date.atTime(item.getStartTime());
                    formattedTime = item.getStartTime().format(TIME_FORMAT);
                } else {
                    // Date anchor only: flexible items have no scheduled clock time.
                    start = date.atStartOfDay();
                    formattedTime = "Flexible";
                }

                LocalDateTime end = null;
                String endFormatted = null;
                if (item.getStartTime() != null && item.getEndTime() != null) {
                    end = date.atTime(item.getEndTime());
                    if (end.isBefore(start)) end = end.plusDays(1);
                    endFormatted = item.getEndTime().format(TIME_FORMAT);
                }

                String textToAnalyze = (item.getTitle() + " " + (item.getDescription() != null ? item.getDescription() : "")).toLowerCase(Locale.ROOT);

                TimelineItemType itemType = TimelineItemType.ACTIVITY;
                String category = "ACTIVITY";
                String icon = "local_activity";
                String badgeColor = "indigo";

                if (containsAny(textToAnalyze, FOOD_KEYWORDS)) {
                    itemType = TimelineItemType.MEAL;
                    category = "FOOD";
                    icon = "restaurant";
                    badgeColor = "amber";
                } else if (containsAny(textToAnalyze, SIGHTSEEING_KEYWORDS)) {
                    itemType = TimelineItemType.ACTIVITY;
                    category = "ACTIVITY";
                    icon = "attractions";
                    badgeColor = "emerald";
                }

                String loc = item.getLocation();
                if (loc == null && item.getPlace() != null) {
                    loc = item.getPlace().getName();
                }

                items.add(TimelineItemResponse.builder()
                        .id("itinerary-item-" + item.getId())
                        .sourceType("ITINERARY_ITEM")
                        .sourceId(item.getId())
                        .itemType(itemType)
                        .category(category)
                        .title(item.getTitle())
                        .subtitle(item.getDescription())
                        .startDatetime(start)
                        .endDatetime(end)
                        .flexible(item.getStartTime() == null)
                        .timeFormatted(formattedTime)
                        .endTimeFormatted(endFormatted)
                        .location(loc)
                        .departure(null)
                        .arrival(null)
                        .provider(null)
                        .bookingReference(null)
                        .status("PLANNED")
                        .amount(item.getEstimatedCost())
                        .currency("INR")
                        .notes(item.getDescription())
                        .icon(icon)
                        .badgeColor(badgeColor)
                        .conflict(false)
                        .build());
            }
        }
        return items;
    }

    private List<TimelineItemResponse> detectConflictsAndGaps(List<TimelineItemResponse> items) {
        List<TimelineItemResponse> result = new ArrayList<>();
        for (TimelineItemResponse original : items) {
            final TimelineItemResponse current = original;
            if (current.flexible()) {
                result.add(current);
                continue;
            }
            TimelineItemResponse overlap = items.stream()
                    .filter(other -> other != current && !other.flexible())
                    .filter(other -> !(other.sourceType().equals(current.sourceType())
                            && Objects.equals(other.sourceId(), current.sourceId())))
                    .filter(other -> overlaps(current, other))
                    .findFirst().orElse(null);
            if (overlap != null) {
                result.add(current.toBuilder().conflict(true)
                        .warning("Schedule conflict: overlaps with '" + overlap.title()
                                + "'. Review the saved times.").build());
                continue;
            }
            // This is a buffer reminder, not an estimated route duration.
            TimelineItemResponse previous = items.stream()
                    .filter(other -> !other.flexible() && blocksTime(other))
                    .filter(other -> other.endDatetime() != null
                            && !other.endDatetime().isAfter(current.startDatetime()))
                    .filter(other -> !Objects.equals(other.id(), current.id()))
                    .filter(other -> !(other.sourceType().equals(current.sourceType())
                            && Objects.equals(other.sourceId(), current.sourceId())))
                    .max(Comparator.comparing(TimelineItemResponse::endDatetime)).orElse(null);
            if (previous != null && hasLocation(previous) && hasLocation(current)
                    && !previous.location().equalsIgnoreCase(current.location())) {
                long minutes = Duration.between(previous.endDatetime(), current.startDatetime()).toMinutes();
                if (minutes < 20) {
                    result.add(current.toBuilder().warning("Only " + minutes
                            + " minutes between locations. Check travel time; this is not a route estimate.").build());
                    continue;
                }
            }
            result.add(current);
        }
        return result;
    }

    private boolean hasLocation(TimelineItemResponse item) {
        return item.location() != null && !item.location().isBlank();
    }

    private boolean blocksTime(TimelineItemResponse item) {
        return item.itemType() != TimelineItemType.HOTEL_CHECKIN
                && item.itemType() != TimelineItemType.HOTEL_CHECKOUT
                && item.itemType() != TimelineItemType.TRANSPORT_ARRIVAL;
    }

    private boolean overlaps(TimelineItemResponse a, TimelineItemResponse b) {
        // Check-in/out and arrival are milestones, not the duration of an entire stay.
        if (!blocksTime(a) || !blocksTime(b)) return false;
        LocalDateTime aEnd = a.endDatetime(), bEnd = b.endDatetime();
        if (aEnd == null || bEnd == null) return false; // Never invent durations.
        return aEnd.isAfter(a.startDatetime()) && bEnd.isAfter(b.startDatetime())
                && a.startDatetime().isBefore(bEnd) && b.startDatetime().isBefore(aEnd);
    }

    private String resolveDayTitle(ItineraryDay itinDay, List<TimelineItemResponse> items, int dayNumber, Trip trip, LocalDate date) {
        if (itinDay != null && itinDay.getTitle() != null && !itinDay.getTitle().isBlank()) {
            return itinDay.getTitle();
        }

        // Check if there is a transport route on this day (e.g. Chennai → Madurai)
        for (TimelineItemResponse item : items) {
            if (item.departure() != null && !item.departure().isBlank()
                    && item.arrival() != null && !item.arrival().isBlank()) {
                return item.departure() + " → " + item.arrival();
            }
        }

        return "Day " + dayNumber + " • " + (trip.getDestination() != null ? trip.getDestination() : "Trip Itinerary");
    }

    private String formatTime(LocalDateTime dt) {
        return dt != null ? dt.format(TIME_FORMAT) : null;
    }

    private String getTransportIcon(TransportType type, boolean isDeparture) {
        if (type == null) return isDeparture ? "flight_takeoff" : "flight_land";
        return switch (type) {
            case FLIGHT -> isDeparture ? "flight_takeoff" : "flight_land";
            case BUS -> "directions_bus";
            case TRAIN -> "train";
            case CAR, RENTAL_CAR, TAXI, AUTO -> "directions_car";
            case BIKE -> "two_wheeler";
            default -> "commute";
        };
    }

    private String getTransportBadgeColor(TransportType type) {
        if (type == null) return "blue";
        return switch (type) {
            case FLIGHT -> "blue";
            case BUS -> "amber";
            case TRAIN -> "rose";
            case CAR, RENTAL_CAR -> "emerald";
            default -> "indigo";
        };
    }

    private boolean containsAny(String text, Set<String> keywords) {
        if (text == null || text.isBlank()) return false;
        for (String kw : keywords) {
            if (text.contains(kw)) return true;
        }
        return false;
    }

    private Trip findTripOrThrow(Long tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));
    }

    private void verifyCanView(Trip trip, Long userId) {
        if (trip.getOwner().getId().equals(userId)) return;
        boolean isMember = tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(
                trip.getId(), userId, MemberStatus.ACTIVE);
        if (!isMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this trip");
        }
    }
}

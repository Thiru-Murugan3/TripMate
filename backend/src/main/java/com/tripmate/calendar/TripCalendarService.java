package com.tripmate.calendar;

import com.tripmate.itinerary.ItineraryItem;
import com.tripmate.itinerary.ItineraryItemRepository;
import com.tripmate.trip.TripResponse;
import com.tripmate.trip.TripService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TripCalendarService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");
    private final TripService tripService;
    private final ItineraryItemRepository itineraryItemRepository;

    @Transactional(readOnly = true)
    public CalendarExport export(Long tripId, Long userId) {
        TripResponse trip = tripService.getTripById(tripId, userId);
        List<ItineraryItem> items = itineraryItemRepository
                .findByTripIdOrderByItineraryDayDayNumberAscDisplayOrderAscIdAsc(tripId);
        String stamp = LocalDateTime.now(ZoneOffset.UTC).format(DATE_TIME) + "Z";
        StringBuilder calendar = new StringBuilder()
                .append("BEGIN:VCALENDAR\r\n")
                .append("VERSION:2.0\r\n")
                .append("PRODID:-//TripMate//Trip Calendar//EN\r\n")
                .append("CALSCALE:GREGORIAN\r\n")
                .append("METHOD:PUBLISH\r\n");

        appendAllDayEvent(calendar, "trip-" + trip.id() + "@tripmate", stamp,
                trip.startDate(), trip.endDate().plusDays(1), trip.name(),
                trip.description(), trip.destination());

        for (ItineraryItem item : items) {
            LocalDate date = item.getItineraryDay().getDayDate();
            if (date == null) date = trip.startDate().plusDays(item.getItineraryDay().getDayNumber() - 1L);
            appendActivity(calendar, item, date, stamp, trip.id());
        }
        calendar.append("END:VCALENDAR\r\n");
        String filename = safeFilename(trip.name()) + ".ics";
        return new CalendarExport(filename, calendar.toString().getBytes(StandardCharsets.UTF_8));
    }

    private void appendAllDayEvent(StringBuilder out, String uid, String stamp, LocalDate start,
                                   LocalDate exclusiveEnd, String title, String description, String location) {
        out.append("BEGIN:VEVENT\r\n")
                .append("UID:").append(uid).append("\r\n")
                .append("DTSTAMP:").append(stamp).append("\r\n")
                .append("DTSTART;VALUE=DATE:").append(start.format(DATE)).append("\r\n")
                .append("DTEND;VALUE=DATE:").append(exclusiveEnd.format(DATE)).append("\r\n")
                .append("SUMMARY:").append(escape(title)).append("\r\n")
                .append("DESCRIPTION:").append(escape(description)).append("\r\n")
                .append("LOCATION:").append(escape(location)).append("\r\n")
                .append("END:VEVENT\r\n");
    }

    private void appendActivity(StringBuilder out, ItineraryItem item, LocalDate date, String stamp, Long tripId) {
        LocalTime startTime = item.getStartTime();
        LocalTime endTime = item.getEndTime();
        out.append("BEGIN:VEVENT\r\n")
                .append("UID:trip-").append(tripId).append("-activity-").append(item.getId()).append("@tripmate\r\n")
                .append("DTSTAMP:").append(stamp).append("\r\n");
        if (startTime == null) {
            out.append("DTSTART;VALUE=DATE:").append(date.format(DATE)).append("\r\n")
                    .append("DTEND;VALUE=DATE:").append(date.plusDays(1).format(DATE)).append("\r\n");
        } else {
            LocalDateTime start = LocalDateTime.of(date, startTime);
            LocalDateTime end = LocalDateTime.of(date, endTime == null ? startTime.plusHours(1) : endTime);
            if (!end.isAfter(start)) end = end.plusDays(1);
            out.append("DTSTART:").append(start.format(DATE_TIME)).append("\r\n")
                    .append("DTEND:").append(end.format(DATE_TIME)).append("\r\n");
        }
        out.append("SUMMARY:").append(escape(item.getTitle())).append("\r\n")
                .append("DESCRIPTION:").append(escape(item.getDescription())).append("\r\n")
                .append("LOCATION:").append(escape(item.getLocation())).append("\r\n")
                .append("END:VEVENT\r\n");
    }

    private String escape(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
                .replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n");
    }

    private String safeFilename(String value) {
        String safe = value == null ? "tripmate-trip" : value.replaceAll("[^a-zA-Z0-9._-]+", "-");
        safe = safe.replaceAll("^-+|-+$", "");
        return safe.isBlank() ? "tripmate-trip" : safe;
    }

    public record CalendarExport(String filename, byte[] content) {}
}

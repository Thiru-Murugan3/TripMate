package com.tripmate.booking.importer;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.booking.BookingType;
import com.tripmate.booking.TransportType;
import com.tripmate.member.TripRole;
import com.tripmate.trip.TripResponse;
import com.tripmate.trip.TripService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class BookingImportService {

    private static final long MAX_BYTES = 10 * 1024 * 1024;
    private static final Pattern REFERENCE = Pattern.compile("(?im)(?:PNR|booking(?:\\s+(?:reference|ref|id))?|confirmation(?:\\s+(?:number|no))?|reservation(?:\\s+(?:id|no))?)\\s*[:#-]?\\s*([A-Z0-9-]{5,18})");
    private static final Pattern AMOUNT = Pattern.compile("(?i)(?:total|amount(?: paid)?|fare)\\s*[:₹$ ]*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)");
    private static final Pattern ROUTE = Pattern.compile("(?im)(?:from|departure)\\s*[: -]\\s*([^\\n\\r]{2,80}).*?(?:to|arrival|destination)\\s*[: -]\\s*([^\\n\\r]{2,80})");
    private static final String MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
    private static final Pattern DATE = Pattern.compile(
            "(?i)\\b(" +
                    "\\d{4}[./-]\\d{1,2}[./-]\\d{1,2}" +
                    "|\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}" +
                    "|\\d{1,2}(?:st|nd|rd|th)?\\s+" + MONTH + "(?:[,]?\\s+\\d{2,4})?" +
                    "|" + MONTH + "\\s+\\d{1,2}(?:st|nd|rd|th)?(?:[,]?\\s+\\d{2,4})?" +
                    ")\\b(?:[, ]+(\\d{1,2}[:.]\\d{2})(?:\\s*(AM|PM))?)?");

    private final TripService tripService;
    private final RestClient restClient = RestClient.create();

    @Value("${booking-import.ocr-space.api-url:https://api.ocr.space/parse/image}")
    private String apiUrl;

    @Value("${booking-import.ocr-space.api-key:}")
    private String apiKey;

    public BookingImportDraft importFile(Long tripId, Long userId, MultipartFile file) {
        TripResponse trip = tripService.getTripById(tripId, userId);
        if (trip.userRole() == TripRole.VIEWER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission to import bookings");
        }
        validate(file);
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Booking OCR is not configured. Set OCR_SPACE_API_KEY on the backend service.");
        }

        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("apikey", apiKey);
            body.add("language", "eng");
            body.add("isOverlayRequired", "false");
            body.add("scale", "true");
            body.add("OCREngine", "2");
            body.add("file", new NamedByteArrayResource(file.getBytes(), safeName(file.getOriginalFilename())));

            JsonNode response = restClient.post().uri(apiUrl)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body).retrieve().body(JsonNode.class);
            if (response == null || response.path("IsErroredOnProcessing").asBoolean()) {
                String error = response == null ? "OCR provider returned no response"
                        : response.path("ErrorMessage").toString();
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OCR provider error: " + error);
            }
            StringBuilder text = new StringBuilder();
            for (JsonNode page : response.path("ParsedResults")) {
                if (!text.isEmpty()) text.append('\n');
                text.append(page.path("ParsedText").asText(""));
            }
            if (text.toString().isBlank()) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "No readable booking text was found in this file.");
            }
            return extract(text.toString(), trip.startDate().getYear());
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to read uploaded file");
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Unable to process this booking with OCR.Space. Please try again.");
        }
    }

    BookingImportDraft extract(String text, int defaultYear) {
        String lower = text.toLowerCase(Locale.ROOT);
        BookingType type = lower.matches("(?s).*(flight|airline|boarding pass|train|railway|bus|coach|cab|taxi).*" )
                ? BookingType.TRANSPORT
                : lower.matches("(?s).*(hotel|check-in|check in|room|accommodation).*" ) ? BookingType.HOTEL : BookingType.ACTIVITY;
        TransportType transport = type == BookingType.TRANSPORT ? transportType(lower) : null;
        String reference = group(REFERENCE, text, 1);
        Matcher route = ROUTE.matcher(text);
        boolean routeFound = route.find();
        String departure = routeFound ? clean(route.group(1)) : null;
        String arrival = routeFound ? clean(route.group(2)) : null;
        Matcher amountMatcher = AMOUNT.matcher(text);
        BigDecimal amount = amountMatcher.find()
                ? new BigDecimal(amountMatcher.group(1).replace(",", "")) : BigDecimal.ZERO;
        List<LocalDateTime> dates = dates(text, defaultYear);
        String provider = provider(text, type);
        List<String> warnings = new ArrayList<>();
        if (provider == null) warnings.add("Provider name was not confidently detected.");
        if (reference == null) warnings.add("Booking reference or PNR was not detected.");
        if (dates.isEmpty()) warnings.add("Travel/check-in date was not detected.");
        if (type == BookingType.TRANSPORT && (departure == null || arrival == null))
            warnings.add("Review the departure and arrival locations.");
        int detected = 5 - warnings.size();
        double confidence = Math.max(0.25, Math.min(0.95, 0.35 + detected * 0.12));
        return new BookingImportDraft(type, transport, provider, reference, departure, arrival,
                dates.isEmpty() ? null : dates.get(0), dates.size() > 1 ? dates.get(1) : null,
                amount, lower.contains("$") || lower.contains("usd") ? "USD" : "INR",
                confidence, warnings, text.length() > 12000 ? text.substring(0, 12000) : text);
    }

    private TransportType transportType(String text) {
        if (text.contains("flight") || text.contains("airline") || text.contains("boarding pass")) return TransportType.FLIGHT;
        if (text.contains("train") || text.contains("railway")) return TransportType.TRAIN;
        if (text.contains("bus") || text.contains("coach")) return TransportType.BUS;
        if (text.contains("taxi") || text.contains("cab")) return TransportType.TAXI;
        return TransportType.OTHER;
    }

    private String provider(String text, BookingType type) {
        String[] known = {"IndiGo", "Air India", "SpiceJet", "Akasa Air", "Vistara", "IRCTC",
                "MakeMyTrip", "Booking.com", "Agoda", "Goibibo", "OYO", "RedBus"};
        for (String name : known) if (text.toLowerCase(Locale.ROOT).contains(name.toLowerCase(Locale.ROOT))) return name;
        for (String line : text.split("\\R")) {
            String value = clean(line);
            if (value != null && value.length() >= 3 && value.length() <= 80 && value.matches(".*[A-Za-z].*")) return value;
        }
        return type == BookingType.HOTEL ? "Hotel" : null;
    }

    private List<LocalDateTime> dates(String text, int defaultYear) {
        List<LocalDateTime> values = new ArrayList<>();
        Matcher matcher = DATE.matcher(text);
        while (matcher.find() && values.size() < 2) {
            LocalDate date = parseDate(matcher.group(1), defaultYear);
            if (date == null) continue;
            LocalTime time = parseTime(matcher.group(2), matcher.group(3));
            values.add(LocalDateTime.of(date, time == null ? LocalTime.NOON : time));
        }
        return values;
    }

    private LocalDate parseDate(String value, int defaultYear) {
        String normalized = value.replaceAll("(?i)(\\d)(st|nd|rd|th)", "$1")
                .replace(',', ' ').replaceAll("\\s+", " ").trim();
        List<String> patterns = List.of("uuuu/M/d", "uuuu-M-d", "uuuu.M.d", "d/M/uuuu", "d-M-uuuu", "d.M.uuuu",
                "d/M/uu", "d-M-uu", "d.M.uu", "d MMM uuuu", "d MMMM uuuu", "MMM d uuuu", "MMMM d uuuu");
        for (String pattern : patterns) {
            try { return LocalDate.parse(normalized, DateTimeFormatter.ofPattern(pattern, Locale.ENGLISH)); }
            catch (DateTimeParseException ignored) {}
        }
        for (String pattern : List.of("d MMM", "d MMMM", "MMM d", "MMMM d")) {
            try {
                return LocalDate.parse(normalized + " " + defaultYear,
                        DateTimeFormatter.ofPattern(pattern + " uuuu", Locale.ENGLISH));
            } catch (DateTimeParseException ignored) {}
        }
        return null;
    }

    private LocalTime parseTime(String value, String meridiem) {
        if (value == null) return null;
        try {
            return LocalTime.parse(value.replace('.', ':') + (meridiem == null ? "" : " " + meridiem.toUpperCase(Locale.ROOT)),
                    DateTimeFormatter.ofPattern(meridiem == null ? "H:mm" : "h:mm a", Locale.ENGLISH));
        } catch (DateTimeParseException ignored) { return null; }
    }

    private String group(Pattern pattern, String text, int index) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? clean(matcher.group(index)) : null;
    }

    private String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim().replaceAll("\\s+", " ");
        return cleaned.isBlank() ? null : cleaned;
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a PDF or image file");
        if (file.getSize() > MAX_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "File must be 10 MB or smaller");
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!(type.equals("application/pdf") || type.equals("image/png") || type.equals("image/jpeg")))
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only PDF, PNG and JPG booking files are supported");
    }

    private String safeName(String name) { return name == null || name.isBlank() ? "booking-file" : name.replaceAll("[^a-zA-Z0-9._-]", "_"); }

    private static final class NamedByteArrayResource extends ByteArrayResource {
        private final String filename;
        private NamedByteArrayResource(byte[] bytes, String filename) { super(bytes); this.filename = filename; }
        @Override public String getFilename() { return filename; }
    }
}

package com.tripmate.booking.importer;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BookingImportServiceTest {

    private final BookingImportService service = new BookingImportService(null);

    @Test
    void recognisesCommonIndianBookingDateFormats() {
        assertStart("Journey Date: 27 Sep 2026 06:30 AM", LocalDateTime.of(2026, 9, 27, 6, 30));
        assertStart("Departure: Sep 27, 2026 18.45", LocalDateTime.of(2026, 9, 27, 18, 45));
        assertStart("Travel on 27/09/26", LocalDateTime.of(2026, 9, 27, 12, 0));
        assertStart("Check-in 2026-09-27", LocalDateTime.of(2026, 9, 27, 12, 0));
        assertStart("Boarding 27th September 07:15", LocalDateTime.of(2026, 9, 27, 7, 15));
    }

    private void assertStart(String text, LocalDateTime expected) {
        BookingImportDraft draft = service.extract("IndiGo Flight\nPNR: ABC123\n" + text, 2026);
        assertEquals(expected, draft.startDatetime());
    }
}

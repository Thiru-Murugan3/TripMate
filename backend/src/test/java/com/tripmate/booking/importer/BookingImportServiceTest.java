package com.tripmate.booking.importer;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

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

    @Test
    void extractsMakeMyTripBusTicketWithoutReadingTermsAsBookingData() {
        String text = """
                Board the bus with mobile e-ticket
                Booking Details
                From: Chennai                        Bus Operator: Viyan Transport
                Ticket Number: VYTA-AP-7699997482 (Operator PNR: ABPDS8RG)
                To: Erode                            Bus Type: A/c-sleeper
                MakeMyTrip Bus ID: NU710891192291196
                Boarding Date and Time: 24-Sep-2026
                21:30
                Passengers: 1                       Total Fare:
                735.0
                Passenger Details
                S.No Name Seat Seat Type
                1
                Ms. Amaravathi
                L2
                Sleeper
                Boarding Point:

                Sholinganallur
                Drop Point: Erode Bus Stand
                The departure and arrival timings mentioned on the e-ticket are only tentative timings.
                Till 09:00 AM on 24 Sep Rs. 70.0
                """;

        BookingImportDraft draft = service.extract(text, 2026);

        assertEquals("Viyan Transport", draft.providerName());
        assertEquals("ABPDS8RG", draft.bookingReference());
        assertEquals("Chennai", draft.departure());
        assertEquals("Erode", draft.arrival());
        assertEquals("Ms. Amaravathi | Seat L2 | Sleeper", draft.passengerDetails());
        assertEquals("Sholinganallur", draft.pickupPoint());
        assertEquals("Erode Bus Stand", draft.dropPoint());
        assertEquals(LocalDateTime.of(2026, 9, 24, 21, 30), draft.startDatetime());
        assertNull(draft.endDatetime());
        assertEquals("735.0", draft.amount().toPlainString());
    }

    private void assertStart(String text, LocalDateTime expected) {
        BookingImportDraft draft = service.extract("IndiGo Flight\nPNR: ABC123\n" + text, 2026);
        assertEquals(expected, draft.startDatetime());
    }
}

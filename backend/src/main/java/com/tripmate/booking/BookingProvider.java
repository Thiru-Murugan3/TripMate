package com.tripmate.booking;

public interface BookingProvider {
    BookingSearchResponse search(SearchBookingRequest request);

    ProviderBookingResult book(BookNowRequest request);
}

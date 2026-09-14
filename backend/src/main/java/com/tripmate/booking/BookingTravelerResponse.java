package com.tripmate.booking;

import java.time.LocalDate;

public record BookingTravelerResponse(
        Long id,
        Integer travelerOrder,
        String fullName,
        BookingTravelerGender gender,
        LocalDate dateOfBirth,
        String email,
        String mobile
) {
    public static BookingTravelerResponse from(BookingTraveler traveler) {
        return new BookingTravelerResponse(
                traveler.getId(),
                traveler.getTravelerOrder(),
                traveler.getFullName(),
                traveler.getGender(),
                traveler.getDateOfBirth(),
                traveler.getEmail(),
                traveler.getMobile()
        );
    }
}

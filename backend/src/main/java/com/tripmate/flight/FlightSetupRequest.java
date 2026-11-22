package com.tripmate.flight;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record FlightSetupRequest(
    @NotBlank @Pattern(regexp="[A-Z0-9]{2,3}") String airlineCode,
    @NotBlank @Pattern(regexp="[0-9]{1,4}[A-Z]?") String flightNumber,
    @NotNull LocalDate departureDate,
    @NotBlank @Pattern(regexp="[A-Z]{3,4}") String origin,
    @NotBlank @Pattern(regexp="[A-Z]{3,4}") String destination,
    @NotBlank @Size(max=64) String departureZone,
    boolean enabled
) {}

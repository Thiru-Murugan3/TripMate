package com.tripmate.itinerary;

import jakarta.validation.constraints.*;

/** Stores only a provider identifier and the traveller's own activity title. */
public record AddTripadvisorPlaceRequest(
        @NotBlank @Pattern(regexp = "[0-9]{1,12}") String locationId,
        @NotNull @Min(1) Integer dayNumber,
        @NotBlank @Size(max = 180) String title
) {}

package com.tripmate.trip;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record DuplicateTripRequest(
        @Size(max = 160) String name,
        @NotNull @FutureOrPresent LocalDate startDate
) {}

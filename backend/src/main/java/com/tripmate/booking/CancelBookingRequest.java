package com.tripmate.booking;

import jakarta.validation.constraints.Size;

public record CancelBookingRequest(
        @Size(max = 500, message = "Cancellation reason cannot exceed 500 characters")
        String reason
) {
}

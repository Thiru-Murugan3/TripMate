package com.tripmate.member;

import jakarta.validation.constraints.NotNull;

public record UpdateMemberRoleRequest(

        @NotNull(message = "Trip role is required")
        TripRole role
) {
}

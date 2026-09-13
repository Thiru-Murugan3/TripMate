package com.tripmate.admin;

import com.tripmate.user.UserStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateUserStatusRequest(
        @NotNull(message = "Status is required")
        UserStatus status
) {
}

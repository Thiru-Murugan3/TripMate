package com.tripmate.admin;

import com.tripmate.user.SystemRole;
import com.tripmate.user.User;
import com.tripmate.user.UserStatus;

import java.time.LocalDateTime;

public record AdminUserResponse(
        Long id,
        String name,
        String email,
        String mobile,
        SystemRole systemRole,
        UserStatus status,
        String profilePhotoUrl,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static AdminUserResponse from(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getMobile(),
                user.getSystemRole(),
                user.getStatus(),
                user.getProfilePhotoUrl(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}

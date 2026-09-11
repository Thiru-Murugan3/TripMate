package com.tripmate.user;

import java.time.LocalDateTime;

public record CurrentUserResponse(
        Long id,
        String name,
        String email,
        String mobile,
        SystemRole systemRole,
        UserStatus status,
        LocalDateTime createdAt
) {
    public static CurrentUserResponse from(User user) {
        return new CurrentUserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getMobile(),
                user.getSystemRole(),
                user.getStatus(),
                user.getCreatedAt()
        );
    }
}
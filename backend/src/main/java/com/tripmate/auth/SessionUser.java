package com.tripmate.auth;

import com.tripmate.user.SystemRole;
import com.tripmate.user.User;
import com.tripmate.user.UserStatus;
import java.time.LocalDateTime;

/** Safe identity supplied only after successful server-side authentication. */
public record SessionUser(Long id, String name, String email, String mobile,
                          SystemRole systemRole, UserStatus status, LocalDateTime createdAt) {
    public static SessionUser from(User user) {
        return new SessionUser(user.getId(), user.getName(), user.getEmail(), user.getMobile(),
                user.getSystemRole(), user.getStatus(), user.getCreatedAt());
    }
}

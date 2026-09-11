package com.tripmate.notification;

import com.tripmate.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    // 1. GET /api/v1/notifications
    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getNotifications(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                notificationService.getNotifications(userPrincipal.getId())
        );
    }

    // 2. GET /api/v1/notifications/unread
    @GetMapping("/unread")
    public ResponseEntity<List<NotificationResponse>> getUnreadNotifications(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                notificationService.getUnreadNotifications(userPrincipal.getId())
        );
    }

    // 3. GET /api/v1/notifications/unread/count
    @GetMapping("/unread/count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        long count = notificationService.getUnreadCount(userPrincipal.getId());
        return ResponseEntity.ok(Map.of("count", count));
    }

    // 4. PATCH /api/v1/notifications/{notificationId}/read
    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<NotificationResponse> markAsRead(
            @PathVariable Long notificationId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                notificationService.markAsRead(notificationId, userPrincipal.getId())
        );
    }

    // 5. PATCH /api/v1/notifications/read-all
    @PatchMapping("/read-all")
    public ResponseEntity<Map<String, String>> markAllAsRead(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        notificationService.markAllAsRead(userPrincipal.getId());
        return ResponseEntity.ok(Map.of("message", "All notifications marked as read"));
    }

    // 6. DELETE /api/v1/notifications/{notificationId}
    @DeleteMapping("/{notificationId}")
    public ResponseEntity<Map<String, String>> deleteNotification(
            @PathVariable Long notificationId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        notificationService.deleteNotification(notificationId, userPrincipal.getId());
        return ResponseEntity.ok(Map.of("message", "Notification deleted successfully"));
    }
}

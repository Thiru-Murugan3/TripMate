package com.tripmate.notification;

import com.tripmate.trip.Trip;
import com.tripmate.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SseService sseService;

    @Transactional
    public NotificationResponse createAndSendNotification(
            User recipient,
            Trip trip,
            String title,
            String message,
            NotificationType type
    ) {
        Notification notification = Notification.builder()
                .recipient(recipient)
                .trip(trip)
                .title(title)
                .message(message)
                .type(type != null ? type : NotificationType.GENERAL)
                .isRead(false)
                .build();

        Notification saved = notificationRepository.save(notification);
        NotificationResponse response = NotificationResponse.from(saved);

        // Push real-time event to recipient via SSE
        sseService.sendToUser(recipient.getId(), "notification", response);

        return response;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getNotifications(Long userId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getUnreadNotifications(Long userId) {
        return notificationRepository.findByRecipientIdAndIsReadFalseOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByRecipientIdAndIsReadFalse(userId);
    }

    @Transactional
    public NotificationResponse markAsRead(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findByIdAndRecipientId(notificationId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Notification not found or access denied"));

        notification.setRead(true);
        Notification updated = notificationRepository.save(notification);
        return NotificationResponse.from(updated);
    }

    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllAsReadByRecipientId(userId);
    }

    @Transactional
    public void deleteNotification(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findByIdAndRecipientId(notificationId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Notification not found or access denied"));

        notificationRepository.delete(notification);
    }
}

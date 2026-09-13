package com.tripmate.notification;

import com.tripmate.trip.Trip;
import com.tripmate.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private SseService sseService;

    @InjectMocks
    private NotificationService notificationService;

    private User recipient;
    private Trip trip;
    private Notification notification;

    @BeforeEach
    void setUp() {
        recipient = User.builder()
                .id(1L)
                .name("Recipient User")
                .email("recipient@example.com")
                .build();

        trip = Trip.builder()
                .id(10L)
                .name("Paris Trip")
                .build();

        notification = Notification.builder()
                .id(100L)
                .recipient(recipient)
                .trip(trip)
                .title("Trip Invitation")
                .message("You were invited to Paris Trip")
                .type(NotificationType.GENERAL)
                .isRead(false)
                .build();
    }

    @Test
    @DisplayName("createAndSendNotification: Saves notification and emits SSE event to user")
    void createAndSendNotification_SavesAndPushesSse() {
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification n = invocation.getArgument(0);
            n.setId(100L);
            return n;
        });

        NotificationResponse response = notificationService.createAndSendNotification(
                recipient, trip, "Trip Invitation", "You were invited to Paris Trip", NotificationType.GENERAL);

        assertNotNull(response);
        assertEquals(100L, response.getId());
        assertEquals("Trip Invitation", response.getTitle());
        assertFalse(response.isRead());

        verify(sseService, times(1)).sendToUser(eq(1L), eq("notification"), any(NotificationResponse.class));
    }

    @Test
    @DisplayName("getUnreadCount: Returns count of unread notifications")
    void getUnreadCount_ReturnsCount() {
        when(notificationRepository.countByRecipientIdAndIsReadFalse(1L)).thenReturn(3L);

        long count = notificationService.getUnreadCount(1L);

        assertEquals(3L, count);
    }

    @Test
    @DisplayName("markAsRead: Updates notification isRead flag to true")
    void markAsRead_Success() {
        when(notificationRepository.findByIdAndRecipientId(100L, 1L)).thenReturn(Optional.of(notification));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        NotificationResponse response = notificationService.markAsRead(100L, 1L);

        assertNotNull(response);
        assertTrue(response.isRead());
    }
}

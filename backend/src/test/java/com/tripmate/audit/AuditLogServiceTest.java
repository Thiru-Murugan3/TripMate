package com.tripmate.audit;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditLogServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @InjectMocks
    private AuditLogService auditLogService;

    @Test
    @DisplayName("log: Saves audit log and redacts sensitive passwords or tokens from description")
    void log_SanitizesSecrets() {
        String sensitiveDescription = "User changed password=SecretPassword123 and token=Bearer eyJhbGciOiJIUzI1NiJ9.test.sign";

        auditLogService.log(1L, 10L, AuditAction.PASSWORD_CHANGED, "USER", 1L, sensitiveDescription, "127.0.0.1", "Chrome");

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());

        AuditLog savedLog = captor.getValue();
        assertNotNull(savedLog);
        assertFalse(savedLog.getDescription().contains("SecretPassword123"));
        assertTrue(savedLog.getDescription().contains("***REDACTED***"));
        assertEquals(1L, savedLog.getUserId());
        assertEquals(10L, savedLog.getTripId());
        assertEquals(AuditAction.PASSWORD_CHANGED, savedLog.getAction());
    }

    @Test
    @DisplayName("getAuditLogs: Returns filtered audit logs for admin")
    void getAuditLogs_FiltersSuccessfully() {
        AuditLog log1 = AuditLog.builder()
                .id(100L)
                .userId(5L)
                .tripId(12L)
                .action(AuditAction.MEMBER_ROLE_CHANGED)
                .entityType("TRIP_MEMBER")
                .entityId(23L)
                .description("Member role changed from VIEWER to EDITOR")
                .createdAt(LocalDateTime.now())
                .build();

        when(auditLogRepository.filterAuditLogs(5L, 12L, AuditAction.MEMBER_ROLE_CHANGED))
                .thenReturn(List.of(log1));

        List<AuditLogResponse> responseList = auditLogService.getAuditLogs(5L, 12L, AuditAction.MEMBER_ROLE_CHANGED);

        assertNotNull(responseList);
        assertEquals(1, responseList.size());
        assertEquals(AuditAction.MEMBER_ROLE_CHANGED, responseList.get(0).getAction());
        assertEquals("TRIP_MEMBER", responseList.get(0).getEntityType());
    }
}

package com.tripmate.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public void log(
            Long userId,
            Long tripId,
            AuditAction action,
            String entityType,
            Long entityId,
            String description,
            String ipAddress,
            String userAgent
    ) {
        String safeDescription = sanitizeDescription(description);

        AuditLog auditLog = AuditLog.builder()
                .userId(userId)
                .tripId(tripId)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .description(safeDescription)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .build();

        auditLogRepository.save(auditLog);
    }

    @Transactional
    public void log(
            Long userId,
            Long tripId,
            AuditAction action,
            String entityType,
            Long entityId,
            String description
    ) {
        log(userId, tripId, action, entityType, entityId, description, null, null);
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponse> getAuditLogs(Long userId, Long tripId, AuditAction action) {
        return auditLogRepository.filterAuditLogs(userId, tripId, action)
                .stream()
                .map(AuditLogResponse::from)
                .toList();
    }

    /**
     * Safety rule: never store passwords, JWTs, refresh tokens, reset tokens, or secrets.
     */
    private String sanitizeDescription(String text) {
        if (text == null) {
            return null;
        }

        return text
                .replaceAll("(?i)(password|token|secret|jwt|authorization)[:=]\\s*[^,\\s]+", "$1=***REDACTED***")
                .replaceAll("(?i)Bearer\\s+[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+", "Bearer ***REDACTED***");
    }
}

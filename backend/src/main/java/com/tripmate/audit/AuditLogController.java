package com.tripmate.audit;

import com.tripmate.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;

    // GET /api/v1/admin/audit-logs
    // GET /api/v1/admin/audit-logs?userId=5
    // GET /api/v1/admin/audit-logs?tripId=12
    // GET /api/v1/admin/audit-logs?action=TRIP_DELETED
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AuditLogResponse>> getAuditLogs(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long tripId,
            @RequestParam(required = false) AuditAction action,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        // Fallback programmatic check for ADMIN role
        if (userPrincipal == null || userPrincipal.getAuthorities().stream()
                .noneMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Admin privileges required");
        }

        return ResponseEntity.ok(
                auditLogService.getAuditLogs(userId, tripId, action)
        );
    }
}

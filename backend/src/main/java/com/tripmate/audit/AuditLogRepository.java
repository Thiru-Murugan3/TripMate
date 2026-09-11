package com.tripmate.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<AuditLog> findByTripIdOrderByCreatedAtDesc(Long tripId);

    List<AuditLog> findByActionOrderByCreatedAtDesc(AuditAction action);

    @Query("SELECT a FROM AuditLog a WHERE (:userId IS NULL OR a.userId = :userId) AND (:tripId IS NULL OR a.tripId = :tripId) AND (:action IS NULL OR a.action = :action) ORDER BY a.createdAt DESC")
    List<AuditLog> filterAuditLogs(
            @Param("userId") Long userId,
            @Param("tripId") Long tripId,
            @Param("action") AuditAction action
    );
}

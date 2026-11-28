package com.tripmate.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHashAndRevokedFalse(String tokenHash);

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findByUserIdAndRevokedFalse(Long userId);

    @Modifying
    // Also ends any post-rotation grace period, so no recently rotated token survives a reset.
    @Query("UPDATE RefreshToken r SET r.revoked = true, r.revokedAt = COALESCE(r.revokedAt, CURRENT_TIMESTAMP), r.replacedAt = NULL "
            + "WHERE r.user.id = :userId AND (r.revoked = false OR r.replacedAt IS NOT NULL)")
    void revokeAllUserTokens(@Param("userId") Long userId);

    /** Ends the post-rotation grace period for all of a user's tokens (logout, password reset). */
    @Modifying
    @Query("UPDATE RefreshToken r SET r.replacedAt = NULL WHERE r.user.id = :userId AND r.replacedAt IS NOT NULL")
    void endRotationGrace(@Param("userId") Long userId);
}

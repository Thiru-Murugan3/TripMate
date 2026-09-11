package com.tripmate.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHashAndRevokedFalse(String tokenHash);

    List<RefreshToken> findByUserIdAndRevokedFalse(Long userId);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revoked = true, r.revokedAt = CURRENT_TIMESTAMP WHERE r.user.id = :userId AND r.revoked = false")
    void revokeAllUserTokens(@Param("userId") Long userId);
}

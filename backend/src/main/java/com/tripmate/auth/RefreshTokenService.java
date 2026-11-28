package com.tripmate.auth;

import com.tripmate.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;

    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    public String createRefreshToken(User user) {

        byte[] randomBytes = new byte[64];

        secureRandom.nextBytes(randomBytes);

        String rawToken = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(randomBytes);

        String tokenHash = hashToken(rawToken);

        LocalDateTime expiresAt = LocalDateTime.now()
                .plusSeconds(
                        refreshTokenExpiration / 1000);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .expiresAt(expiresAt)
                .revoked(false)
                .build();

        refreshTokenRepository.save(refreshToken);

        return rawToken;
    }

    public String hashToken(String token) {

        try {

            MessageDigest digest = MessageDigest.getInstance("SHA-256");

            byte[] hash = digest.digest(
                    token.getBytes(
                            StandardCharsets.UTF_8));

            return HexFormat
                    .of()
                    .formatHex(hash);

        } catch (Exception ex) {

            throw new IllegalStateException(
                    "Unable to hash refresh token",
                    ex);
        }
    }

    /**
     * How long a rotated token stays usable. Covers a refresh whose response never reached
     * the app (e.g. it gave up while the server was waking from sleep), which would otherwise
     * sign the user out the next time they open the app.
     */
    static final Duration ROTATION_GRACE = Duration.ofMinutes(5);

    @Transactional
    public RefreshToken validateRefreshToken(String rawToken) {

        String tokenHash = hashToken(rawToken);

        RefreshToken storedToken = refreshTokenRepository
                .findByTokenHash(tokenHash)
                .filter(this::isUsable)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Invalid refresh token"));

        if (storedToken.getExpiresAt()
                .isBefore(LocalDateTime.now())) {

            storedToken.setRevoked(true);
            storedToken.setRevokedAt(LocalDateTime.now());

            refreshTokenRepository.save(storedToken);

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Refresh token expired");
        }

        return storedToken;
    }

    /** Active, or rotated (never logged out) within the grace period. */
    private boolean isUsable(RefreshToken token) {
        if (!Boolean.TRUE.equals(token.getRevoked())) {
            return true;
        }
        LocalDateTime replacedAt = token.getReplacedAt();
        return replacedAt != null
                && replacedAt.plus(ROTATION_GRACE).isAfter(LocalDateTime.now());
    }

    @Transactional
    public String rotateRefreshToken(
            RefreshToken oldToken) {

        LocalDateTime now = LocalDateTime.now();
        // Keep the first rotation time so retries cannot stretch the grace period.
        if (oldToken.getReplacedAt() == null) {
            oldToken.setReplacedAt(now);
        }
        oldToken.setRevoked(true);
        if (oldToken.getRevokedAt() == null) {
            oldToken.setRevokedAt(now);
        }

        refreshTokenRepository.save(oldToken);

        return createRefreshToken(
                oldToken.getUser());
    }

    @Transactional
    public void revokeRefreshToken(String rawToken) {

        String tokenHash = hashToken(rawToken);

        refreshTokenRepository
                .findByTokenHash(tokenHash)
                .ifPresent(token -> {
                    if (!Boolean.TRUE.equals(token.getRevoked())) {
                        token.setRevoked(true);
                        token.setRevokedAt(LocalDateTime.now());
                        refreshTokenRepository.save(token);
                    }
                    // A logged-out session must not come back through a recently rotated token.
                    refreshTokenRepository.endRotationGrace(token.getUser().getId());
                });
    }
}

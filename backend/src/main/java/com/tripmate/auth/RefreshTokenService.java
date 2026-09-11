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

    @Transactional
    public RefreshToken validateRefreshToken(String rawToken) {

        String tokenHash = hashToken(rawToken);

        RefreshToken storedToken = refreshTokenRepository
                .findByTokenHashAndRevokedFalse(tokenHash)
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

    @Transactional
    public String rotateRefreshToken(
            RefreshToken oldToken) {

        oldToken.setRevoked(true);
        oldToken.setRevokedAt(LocalDateTime.now());

        refreshTokenRepository.save(oldToken);

        return createRefreshToken(
                oldToken.getUser());
    }

    @Transactional
    public void revokeRefreshToken(String rawToken) {

        String tokenHash = hashToken(rawToken);

        refreshTokenRepository
                .findByTokenHashAndRevokedFalse(tokenHash)
                .ifPresent(token -> {
                    token.setRevoked(true);
                    token.setRevokedAt(LocalDateTime.now());
                    refreshTokenRepository.save(token);
                });
    }
}

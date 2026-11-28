package com.tripmate.auth;

import com.tripmate.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    private RefreshTokenService refreshTokenService;

    private User user;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(refreshTokenService, "refreshTokenExpiration", 604800000L);
        user = new User();
        user.setId(1L);
    }

    private RefreshToken stored(String raw) {
        RefreshToken token = RefreshToken.builder()
                .user(user)
                .tokenHash(refreshTokenService.hashToken(raw))
                .expiresAt(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .build();
        when(refreshTokenRepository.findByTokenHash(token.getTokenHash())).thenReturn(Optional.of(token));
        return token;
    }

    @Test
    @DisplayName("an active refresh token is accepted")
    void acceptsActiveToken() {
        RefreshToken token = stored("active");
        assertSame(token, refreshTokenService.validateRefreshToken("active"));
    }

    @Test
    @DisplayName("a just-rotated token still works when the app never received its replacement")
    void acceptsRecentlyRotatedToken() {
        RefreshToken token = stored("lost-response");
        refreshTokenService.rotateRefreshToken(token);

        assertTrue(token.getRevoked());
        assertNotNull(token.getReplacedAt());
        assertSame(token, refreshTokenService.validateRefreshToken("lost-response"));
    }

    @Test
    @DisplayName("a rotated token stops working after the grace period")
    void rejectsRotatedTokenAfterGrace() {
        RefreshToken token = stored("old");
        token.setRevoked(true);
        token.setReplacedAt(LocalDateTime.now().minus(RefreshTokenService.ROTATION_GRACE).minusSeconds(1));

        assertThrows(ResponseStatusException.class, () -> refreshTokenService.validateRefreshToken("old"));
    }

    @Test
    @DisplayName("retrying a rotated token does not extend its grace period")
    void retryKeepsFirstRotationTime() {
        RefreshToken token = RefreshToken.builder().user(user).tokenHash("h").expiresAt(LocalDateTime.now().plusDays(7)).build();
        LocalDateTime firstRotation = LocalDateTime.now().minusMinutes(2);
        token.setRevoked(true);
        token.setReplacedAt(firstRotation);

        refreshTokenService.rotateRefreshToken(token);

        assertEquals(firstRotation, token.getReplacedAt());
    }

    @Test
    @DisplayName("a logged-out token is never accepted again")
    void rejectsLoggedOutToken() {
        RefreshToken token = stored("logged-out");
        refreshTokenService.revokeRefreshToken("logged-out");

        assertTrue(token.getRevoked());
        assertNull(token.getReplacedAt());
        verify(refreshTokenRepository).endRotationGrace(1L);
        assertThrows(ResponseStatusException.class, () -> refreshTokenService.validateRefreshToken("logged-out"));
    }

    @Test
    @DisplayName("unknown tokens are rejected")
    void rejectsUnknownToken() {
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());
        assertThrows(ResponseStatusException.class, () -> refreshTokenService.validateRefreshToken("nope"));
    }
}

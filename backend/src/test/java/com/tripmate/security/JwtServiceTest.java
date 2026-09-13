package com.tripmate.security;

import com.tripmate.user.SystemRole;
import com.tripmate.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;
    private User testUser;
    private static final String TEST_SECRET = "dGhpcmlzYWRldjUzY3JldGtleWZvcnRyaXBtYXRlYXBwbG9jYWw=";

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "jwtSecret", TEST_SECRET);
        ReflectionTestUtils.setField(jwtService, "accessTokenExpiration", 900000L); // 15 mins

        testUser = User.builder()
                .id(42L)
                .email("testuser@example.com")
                .name("Test User")
                .systemRole(SystemRole.USER)
                .build();
    }

    @Test
    @DisplayName("generateAccessToken: Creates valid token containing user subject and email")
    void generateAccessToken_Success() {
        String token = jwtService.generateAccessToken(testUser);

        assertNotNull(token);
        assertTrue(token.length() > 20);
        assertEquals("testuser@example.com", jwtService.extractEmail(token));
        assertTrue(jwtService.isTokenValid(token));
    }

    @Test
    @DisplayName("isTokenValid: Returns false for expired token")
    void isTokenValid_ExpiredToken_ReturnsFalse() {
        ReflectionTestUtils.setField(jwtService, "accessTokenExpiration", -1000L); // Already expired
        String expiredToken = jwtService.generateAccessToken(testUser);

        assertFalse(jwtService.isTokenValid(expiredToken));
    }

    @Test
    @DisplayName("isTokenValid: Returns false for malformed or tampered token")
    void isTokenValid_InvalidToken_ReturnsFalse() {
        String invalidToken = "header.payload.invalidSignature123456789";

        assertFalse(jwtService.isTokenValid(invalidToken));
    }
}

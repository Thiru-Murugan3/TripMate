package com.tripmate.auth;

import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private PasswordResetService passwordResetService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .name("Test User")
                .email("test@example.com")
                .passwordHash("encoded_Old@123")
                .build();
    }

    // --- CHANGE PASSWORD TESTS ---

    @Test
    @DisplayName("changePassword: Success changes password and revokes refresh tokens")
    void changePassword_Success() {
        ChangePasswordRequest request = new ChangePasswordRequest("Old@123", "New@456", "New@456");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("Old@123", "encoded_Old@123")).thenReturn(true);
        when(passwordEncoder.matches("New@456", "encoded_Old@123")).thenReturn(false);
        when(passwordEncoder.encode("New@456")).thenReturn("encoded_New@456");

        Map<String, String> response = passwordResetService.changePassword(1L, request);

        assertNotNull(response);
        assertEquals("encoded_New@456", testUser.getPasswordHash());
        verify(userRepository).save(testUser);
        verify(refreshTokenRepository).revokeAllUserTokens(1L);
    }

    @Test
    @DisplayName("changePassword: Throws Exception when current password does not match")
    void changePassword_InvalidCurrentPassword() {
        ChangePasswordRequest request = new ChangePasswordRequest("WrongOld", "New@456", "New@456");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("WrongOld", "encoded_Old@123")).thenReturn(false);

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> passwordResetService.changePassword(1L, request)
        );

        assertTrue(ex.getReason().contains("Invalid current password"));
    }

    @Test
    @DisplayName("changePassword: Throws Exception when new password equals current password")
    void changePassword_NewPasswordEqualsCurrent() {
        ChangePasswordRequest request = new ChangePasswordRequest("Old@123", "Old@123", "Old@123");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("Old@123", "encoded_Old@123")).thenReturn(true);

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> passwordResetService.changePassword(1L, request)
        );

        assertTrue(ex.getReason().contains("New password cannot be the same as current password"));
    }

    @Test
    @DisplayName("changePassword: Throws Exception when confirm password does not match new password")
    void changePassword_ConfirmPasswordMismatch() {
        ChangePasswordRequest request = new ChangePasswordRequest("Old@123", "New@456", "Different@456");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("Old@123", "encoded_Old@123")).thenReturn(true);
        when(passwordEncoder.matches("New@456", "encoded_Old@123")).thenReturn(false);

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> passwordResetService.changePassword(1L, request)
        );

        assertTrue(ex.getReason().contains("do not match"));
    }

    // --- FORGOT PASSWORD TESTS ---

    @Test
    @DisplayName("forgotPassword: Success generates token and reset link")
    void forgotPassword_Success() {
        ForgotPasswordRequest request = new ForgotPasswordRequest("test@example.com");

        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));

        Map<String, String> response = passwordResetService.forgotPassword(request);

        assertNotNull(response);
        assertTrue(response.containsKey("resetLink"));
        verify(passwordResetTokenRepository).deleteByUserId(1L);
        verify(passwordResetTokenRepository).save(any(PasswordResetToken.class));
    }

    @Test
    @DisplayName("forgotPassword: User not found returns safe generic message")
    void forgotPassword_UserNotFound() {
        ForgotPasswordRequest request = new ForgotPasswordRequest("nonexistent@example.com");

        when(userRepository.findByEmailIgnoreCase("nonexistent@example.com")).thenReturn(Optional.empty());

        Map<String, String> response = passwordResetService.forgotPassword(request);

        assertNotNull(response);
        assertTrue(response.get("message").contains("If an account exists"));
        verify(passwordResetTokenRepository, never()).save(any());
    }

    // --- RESET PASSWORD TESTS ---

    @Test
    @DisplayName("resetPassword: Success resets password, marks token used, and revokes sessions")
    void resetPassword_Success() {
        ResetPasswordRequest request = new ResetPasswordRequest("valid-token", "New@456", "New@456");

        PasswordResetToken token = PasswordResetToken.builder()
                .id(10L)
                .user(testUser)
                .tokenHash("hashed-token")
                .expiryDate(LocalDateTime.now().plusMinutes(10))
                .used(false)
                .build();

        when(passwordResetTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(passwordEncoder.matches("New@456", "encoded_Old@123")).thenReturn(false);
        when(passwordEncoder.encode("New@456")).thenReturn("encoded_New@456");

        Map<String, String> response = passwordResetService.resetPassword(request);

        assertNotNull(response);
        assertTrue(token.isUsed());
        assertEquals("encoded_New@456", testUser.getPasswordHash());
        verify(userRepository).save(testUser);
        verify(passwordResetTokenRepository).save(token);
        verify(refreshTokenRepository).revokeAllUserTokens(1L);
    }

    @Test
    @DisplayName("resetPassword: Throws Exception when passwords do not match")
    void resetPassword_PasswordMismatch() {
        ResetPasswordRequest request = new ResetPasswordRequest("valid-token", "New@456", "Mismatch@456");

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> passwordResetService.resetPassword(request)
        );

        assertTrue(ex.getReason().contains("do not match"));
    }

    @Test
    @DisplayName("resetPassword: Throws Exception when token is expired")
    void resetPassword_ExpiredToken() {
        ResetPasswordRequest request = new ResetPasswordRequest("expired-token", "New@456", "New@456");

        PasswordResetToken expiredToken = PasswordResetToken.builder()
                .id(10L)
                .user(testUser)
                .tokenHash("hashed-token")
                .expiryDate(LocalDateTime.now().minusMinutes(5)) // Expired
                .used(false)
                .build();

        when(passwordResetTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(expiredToken));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> passwordResetService.resetPassword(request)
        );

        assertTrue(ex.getReason().contains("Invalid or expired password reset token"));
    }

    @Test
    @DisplayName("resetPassword: Throws Exception when token is already used")
    void resetPassword_UsedToken() {
        ResetPasswordRequest request = new ResetPasswordRequest("used-token", "New@456", "New@456");

        PasswordResetToken usedToken = PasswordResetToken.builder()
                .id(10L)
                .user(testUser)
                .tokenHash("hashed-token")
                .expiryDate(LocalDateTime.now().plusMinutes(10))
                .used(true) // Already used
                .build();

        when(passwordResetTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(usedToken));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> passwordResetService.resetPassword(request)
        );

        assertTrue(ex.getReason().contains("Invalid or expired password reset token"));
    }
}

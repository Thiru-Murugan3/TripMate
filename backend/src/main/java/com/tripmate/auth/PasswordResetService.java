package com.tripmate.auth;

import com.tripmate.audit.AuditAction;
import com.tripmate.audit.AuditLogService;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final EmailService emailService;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    @Transactional
    public Map<String, String> changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));

        // 1. Current password must match BCrypt hash
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid current password");
        }

        // 2. New password != current password
        if (request.newPassword().equals(request.currentPassword())
                || passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "New password cannot be the same as current password");
        }

        // 3. New password == confirm password
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "New password and confirm password do not match");
        }

        // Update password hash
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        // Revoke old active refresh tokens
        refreshTokenRepository.revokeAllUserTokens(user.getId());

        // Audit Log
        auditLogService.log(userId, null, AuditAction.PASSWORD_CHANGED, "USER", userId, "Password changed successfully for user");

        return Map.of("message", "Password changed successfully. All active sessions have been logged out.");
    }

    @Transactional
    public Map<String, String> forgotPassword(ForgotPasswordRequest request) {
        String email = request.email().trim().toLowerCase();

        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (user == null) {
            // Return generic message for non-existent users
            return Map.of(
                    "message", "If an account exists with this email, a password reset link has been sent."
            );
        }

        // Delete existing unused reset tokens for this user
        passwordResetTokenRepository.deleteByUserId(user.getId());

        // Generate raw token and hashed token
        String rawToken = UUID.randomUUID().toString();
        String tokenHash = hashToken(rawToken);

        PasswordResetToken resetToken = PasswordResetToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .expiryDate(LocalDateTime.now().plusMinutes(15))
                .used(false)
                .build();

        passwordResetTokenRepository.save(resetToken);

        String normalizedFrontendUrl = frontendUrl.endsWith("/")
                ? frontendUrl.substring(0, frontendUrl.length() - 1)
                : frontendUrl;
        String resetLink = UriComponentsBuilder.fromUriString(normalizedFrontendUrl)
                .path("/reset-password")
                .queryParam("token", rawToken)
                .build()
                .toUriString();

        emailService.sendPasswordResetEmail(user.getEmail(), resetLink);

        return Map.of(
                "message", "If an account exists with this email, a password reset link has been sent."
        );
    }

    @Transactional
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        // 1. New password == confirm password
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "New password and confirm password do not match");
        }

        // 2. Hash incoming token and find in DB
        String tokenHash = hashToken(request.token());
        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Invalid or expired password reset token"));

        // 3. Check not used and not expired
        if (resetToken.isUsed() || resetToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid or expired password reset token");
        }

        User user = resetToken.getUser();

        // Check that new password is not identical to current password
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "New password cannot be the same as current password");
        }

        // 4. Update user password
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        // 5. Mark token as used
        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        // 6. Revoke all user's active refresh tokens
        refreshTokenRepository.revokeAllUserTokens(user.getId());

        // Audit Log
        auditLogService.log(user.getId(), null, AuditAction.PASSWORD_RESET, "USER", user.getId(), "Password reset successfully via reset token");

        return Map.of("message", "Password reset successfully. You can now log in with your new password.");
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to hash token", ex);
        }
    }
}

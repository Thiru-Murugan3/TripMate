package com.tripmate.auth;

import com.tripmate.audit.AuditLogService;
import com.tripmate.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailVerificationServiceTest {
    @Mock UserRepository userRepository;
    @Mock EmailVerificationOtpRepository otpRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock EmailService emailService;
    @Mock AuditLogService auditLogService;
    @Mock AuthService authService;
    @InjectMocks EmailVerificationService service;

    private EmailVerificationOtp pending() {
        var pending=EmailVerificationOtp.builder().email("new@example.com")
                .name("New Traveller").passwordHash("password-hash").otpHash("otp-hash")
                .expiresAt(LocalDateTime.now().plusMinutes(5)).build();
        when(otpRepository.findByEmailIgnoreCase("new@example.com")).thenReturn(Optional.of(pending));
        return pending;
    }
    @Test void invalidOtpNeverCreatesUserOrSession() {
        var pending=pending();
        when(passwordEncoder.matches("000000","otp-hash")).thenReturn(false);
        assertThrows(ResponseStatusException.class,()->service.verifyRegistration(new VerifyEmailRequest("new@example.com","000000")));
        assertEquals(1,pending.getAttemptCount());verify(otpRepository).save(pending);
        verifyNoInteractions(userRepository,authService);
    }
    @Test void expiredOtpNeverCreatesUserOrSession() {
        var pending=pending();pending.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        assertThrows(ResponseStatusException.class,()->service.verifyRegistration(new VerifyEmailRequest("new@example.com","123456")));
        verify(otpRepository).delete(pending);verifyNoInteractions(userRepository,authService);
    }
    @Test void consumedOtpCannotCreateSession() {
        when(otpRepository.findByEmailIgnoreCase("new@example.com")).thenReturn(Optional.empty());
        assertThrows(ResponseStatusException.class,()->service.verifyRegistration(new VerifyEmailRequest("new@example.com","123456")));
        verifyNoInteractions(userRepository,authService);
    }
}

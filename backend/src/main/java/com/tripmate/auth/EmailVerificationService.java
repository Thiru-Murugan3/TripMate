package com.tripmate.auth;

import com.tripmate.audit.AuditAction;
import com.tripmate.audit.AuditLogService;
import com.tripmate.user.SystemRole;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import com.tripmate.user.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final int OTP_EXPIRY_MINUTES = 5;
    private static final int MAX_ATTEMPTS = 5;

    private final UserRepository userRepository;
    private final EmailVerificationOtpRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final AuditLogService auditLogService;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public RegistrationPendingResponse startRegistration(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();

        // 1. Check duplicate email in users table
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "An account already exists with this email address."
            );
        }

        // 2. Check duplicate mobile in users table
        if (request.mobile() != null && !request.mobile().isBlank() && userRepository.existsByMobile(request.mobile().trim())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "An account already exists with this mobile number."
            );
        }

        // 3. Generate 6-digit OTP
        String otpCode = String.format("%06d", random.nextInt(1000000));
        String hashedOtp = passwordEncoder.encode(otpCode);
        String hashedPassword = passwordEncoder.encode(request.password());

        // 4. Save or update pending verification record
        EmailVerificationOtp pending = otpRepository.findByEmailIgnoreCase(email)
                .orElseGet(() -> EmailVerificationOtp.builder().email(email).build());

        pending.setName(request.name().trim());
        pending.setMobile(request.mobile() != null ? request.mobile().trim() : null);
        pending.setPasswordHash(hashedPassword);
        pending.setOtpHash(hashedOtp);
        pending.setExpiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
        pending.setAttemptCount(0);

        otpRepository.save(pending);

        // 5. Send OTP via email/console
        emailService.sendVerificationOtpEmail(email, otpCode);

        return new RegistrationPendingResponse(
                "OTP verification code sent to your email",
                email,
                OTP_EXPIRY_MINUTES * 60L,
                otpCode
        );
    }

    @Transactional
    public void verifyRegistration(VerifyEmailRequest request) {
        String email = request.email().trim().toLowerCase();
        String inputOtp = request.otp().trim();

        EmailVerificationOtp pending = otpRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "No pending registration found for this email address."
                ));

        // Check expiry
        if (LocalDateTime.now().isAfter(pending.getExpiresAt())) {
            otpRepository.delete(pending);
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "OTP code has expired. Please request a new verification code."
            );
        }

        // Check max attempts
        if (pending.getAttemptCount() >= MAX_ATTEMPTS) {
            otpRepository.delete(pending);
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Maximum verification attempts exceeded. Please register again."
            );
        }

        // Verify OTP hash
        boolean matches = passwordEncoder.matches(inputOtp, pending.getOtpHash());
        if (!matches) {
            int newCount = pending.getAttemptCount() + 1;
            pending.setAttemptCount(newCount);
            otpRepository.save(pending);

            int remaining = MAX_ATTEMPTS - newCount;
            if (remaining <= 0) {
                otpRepository.delete(pending);
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Maximum verification attempts reached. Registration reset."
                );
            }

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid OTP code. " + remaining + " attempt(s) remaining."
            );
        }

        // OTP Valid -> Create ACTIVE User
        User user = User.builder()
                .name(pending.getName())
                .email(pending.getEmail())
                .mobile(pending.getMobile())
                .passwordHash(pending.getPasswordHash())
                .systemRole(SystemRole.USER)
                .status(UserStatus.ACTIVE)
                .build();

        User savedUser = userRepository.save(user);

        // Remove pending OTP record
        otpRepository.delete(pending);

        // Audit Log
        auditLogService.log(savedUser.getId(), null, AuditAction.USER_REGISTERED, "USER", savedUser.getId(), "User email verified & account created: " + savedUser.getEmail());
    }

    @Transactional
    public Map<String, String> resendOtp(String emailRaw) {
        String email = emailRaw.trim().toLowerCase();

        EmailVerificationOtp pending = otpRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "No pending registration found for this email address."
                ));

        // Generate new 6-digit OTP
        String newOtpCode = String.format("%06d", random.nextInt(1000000));
        pending.setOtpHash(passwordEncoder.encode(newOtpCode));
        pending.setExpiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
        pending.setAttemptCount(0);

        otpRepository.save(pending);

        emailService.sendVerificationOtpEmail(email, newOtpCode);

        return Map.of(
                "message", "OTP resent successfully",
                "devOtp", newOtpCode
        );
    }
}

package com.tripmate.auth;

import com.tripmate.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationService emailVerificationService;
    private final PasswordResetService passwordResetService;
    private final GoogleAuthService googleAuthService;

    @PostMapping("/register")
    public ResponseEntity<RegistrationPendingResponse> register(
            @Valid @RequestBody RegisterRequest request) {

        RegistrationPendingResponse response = emailVerificationService.startRegistration(request);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest request) {

        emailVerificationService.verifyRegistration(request);

        return ResponseEntity.ok(
                Map.of("message", "Email verified successfully. Account created.")
        );
    }

    @PostMapping("/resend-email-otp")
    public ResponseEntity<Map<String, String>> resendOtp(
            @Valid @RequestBody ResendEmailOtpRequest request) {

        return ResponseEntity.ok(
                emailVerificationService.resendOtp(request.email())
        );
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request) {

        LoginResponse response = authService.login(request);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/google/config")
    public ResponseEntity<GoogleAuthConfigResponse> googleConfig() {
        return ResponseEntity.ok(googleAuthService.getConfig());
    }

    @PostMapping("/google")
    public ResponseEntity<LoginResponse> googleLogin(
            @Valid @RequestBody GoogleLoginRequest request) {

        return ResponseEntity.ok(
                googleAuthService.login(request.credential())
        );
    }

    @PostMapping("/refresh")
    public ResponseEntity<RefreshResponse> refresh(
            @Valid @RequestBody RefreshRequest request) {

        return ResponseEntity.ok(
                authService.refresh(request));
    }

    @PostMapping("/logout")
    public ResponseEntity<LogoutResponse> logout(
            @Valid @RequestBody LogoutRequest request) {

        return ResponseEntity.ok(
                authService.logout(request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        return ResponseEntity.ok(
                passwordResetService.changePassword(userPrincipal.getId(), request)
        );
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request
    ) {
        return ResponseEntity.ok(
                passwordResetService.forgotPassword(request)
        );
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request
    ) {
        return ResponseEntity.ok(
                passwordResetService.resetPassword(request)
        );
    }
}

package com.tripmate.auth;

import com.tripmate.audit.AuditAction;
import com.tripmate.audit.AuditLogService;
import com.tripmate.security.JwtService;
import com.tripmate.user.SystemRole;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import com.tripmate.user.UserStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.UUID;

@Service
public class GoogleAuthService {

    private static final String GOOGLE_JWK_SET_URI =
            "https://www.googleapis.com/oauth2/v3/certs";

    private final String clientId;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final AuditLogService auditLogService;
    private final JwtDecoder googleJwtDecoder;

    public GoogleAuthService(
            @Value("${google.oauth.client-id:}") String clientId,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RefreshTokenService refreshTokenService,
            AuditLogService auditLogService
    ) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.auditLogService = auditLogService;

        NimbusJwtDecoder decoder = NimbusJwtDecoder
                .withJwkSetUri(GOOGLE_JWK_SET_URI)
                .build();

        OAuth2TokenValidator<Jwt> defaults = JwtValidators.createDefault();

        OAuth2TokenValidator<Jwt> issuerValidator = jwt -> {
            String issuer = jwt.getClaimAsString("iss");
            boolean validIssuer =
                    "https://accounts.google.com".equals(issuer)
                            || "accounts.google.com".equals(issuer);

            if (validIssuer) {
                return OAuth2TokenValidatorResult.success();
            }

            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error(
                            "invalid_token",
                            "Invalid Google token issuer",
                            null
                    )
            );
        };

        OAuth2TokenValidator<Jwt> audienceValidator = jwt -> {
            boolean validAudience =
                    !this.clientId.isBlank()
                            && jwt.getAudience() != null
                            && jwt.getAudience().contains(this.clientId);

            if (validAudience) {
                return OAuth2TokenValidatorResult.success();
            }

            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error(
                            "invalid_token",
                            "Google token audience does not match TripMate",
                            null
                    )
            );
        };

        decoder.setJwtValidator(
                new DelegatingOAuth2TokenValidator<>(
                        defaults,
                        issuerValidator,
                        audienceValidator
                )
        );

        this.googleJwtDecoder = decoder;
    }

    public GoogleAuthConfigResponse getConfig() {
        return new GoogleAuthConfigResponse(
                isConfigured() ? clientId : "",
                isConfigured()
        );
    }

    public boolean isConfigured() {
        return !clientId.isBlank();
    }

    @Transactional
    public LoginResponse login(String credential) {
        if (!isConfigured()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Google Sign-In is not configured on the TripMate server"
            );
        }

        Jwt googleToken;
        try {
            googleToken = googleJwtDecoder.decode(credential);
        } catch (JwtException ex) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid or expired Google credential"
            );
        }

        String googleSubject = googleToken.getSubject();
        String email = normalizeEmail(googleToken.getClaimAsString("email"));
        Boolean emailVerified = googleToken.getClaimAsBoolean("email_verified");
        String hostedDomain = googleToken.getClaimAsString("hd");
        String name = googleToken.getClaimAsString("name");
        String picture = googleToken.getClaimAsString("picture");

        if (googleSubject == null || googleSubject.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Google account identifier is missing"
            );
        }

        if (email == null || email.isBlank() || !Boolean.TRUE.equals(emailVerified)) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Google account email must be verified"
            );
        }

        User user = userRepository
                .findByGoogleSubject(googleSubject)
                .orElse(null);

        if (user == null) {
            User existingByEmail = userRepository
                    .findByEmailIgnoreCase(email)
                    .orElse(null);

            if (existingByEmail != null) {
                if (!isGoogleAuthoritativeForEmail(email, hostedDomain)) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "This email already has a TripMate account. Sign in with your password before linking Google."
                    );
                }

                existingByEmail.setGoogleSubject(googleSubject);

                if ((existingByEmail.getProfilePhotoUrl() == null
                        || existingByEmail.getProfilePhotoUrl().isBlank())
                        && picture != null
                        && !picture.isBlank()) {
                    existingByEmail.setProfilePhotoUrl(picture);
                }

                user = userRepository.save(existingByEmail);
            } else {
                String displayName =
                        name == null || name.isBlank()
                                ? defaultNameFromEmail(email)
                                : name.trim();

                user = User.builder()
                        .name(displayName)
                        .email(email)
                        .passwordHash(
                                passwordEncoder.encode(
                                        UUID.randomUUID().toString()
                                )
                        )
                        .googleSubject(googleSubject)
                        .profilePhotoUrl(
                                picture == null || picture.isBlank()
                                        ? null
                                        : picture
                        )
                        .systemRole(SystemRole.USER)
                        .status(UserStatus.ACTIVE)
                        .build();

                user = userRepository.save(user);

                auditLogService.log(
                        user.getId(),
                        null,
                        AuditAction.USER_REGISTERED,
                        "USER",
                        user.getId(),
                        "User registered with Google: " + user.getEmail()
                );
            }
        }

        if (user.getStatus() != UserStatus.ACTIVE) {
            auditLogService.log(
                    user.getId(),
                    null,
                    AuditAction.LOGIN_FAILED,
                    "USER",
                    user.getId(),
                    "Blocked user Google login attempt for email: " + user.getEmail()
            );

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User account is blocked"
            );
        }

        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = refreshTokenService.createRefreshToken(user);

        auditLogService.log(
                user.getId(),
                null,
                AuditAction.LOGIN_SUCCESS,
                "USER",
                user.getId(),
                "Google login successful for email: " + user.getEmail()
        );

        return new LoginResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                accessToken,
                refreshToken,
                "Bearer",
                900
        );
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }

        return email.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isGoogleAuthoritativeForEmail(
            String email,
            String hostedDomain
    ) {
        return email.endsWith("@gmail.com")
                || (hostedDomain != null && !hostedDomain.isBlank());
    }

    private String defaultNameFromEmail(String email) {
        int atIndex = email.indexOf('@');
        String rawName = atIndex > 0 ? email.substring(0, atIndex) : email;

        if (rawName.isBlank()) {
            return "TripMate User";
        }

        return rawName;
    }
}

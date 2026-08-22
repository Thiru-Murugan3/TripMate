package com.tripmate.auth;

import com.tripmate.security.JwtService;
import com.tripmate.user.SystemRole;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import com.tripmate.user.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import com.tripmate.security.JwtService;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;

    public RegisterResponse register(RegisterRequest request) {

        String email = request.email()
                .trim()
                .toLowerCase();

        // Check duplicate email
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email already registered");
        }

        // Check duplicate mobile
        if (request.mobile() != null
                && !request.mobile().isBlank()
                && userRepository.existsByMobile(request.mobile())) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Mobile number already registered");
        }

        User user = User.builder()
                .name(request.name().trim())
                .email(email)
                .mobile(
                        request.mobile() == null
                                || request.mobile().isBlank()
                                        ? null
                                        : request.mobile().trim())
                .passwordHash(
                        passwordEncoder.encode(request.password()))
                .systemRole(SystemRole.USER)
                .status(UserStatus.ACTIVE)
                .build();

        User savedUser = userRepository.save(user);

        return new RegisterResponse(
                savedUser.getId(),
                savedUser.getName(),
                savedUser.getEmail(),
                "User registered successfully");
    }

    public LoginResponse login(LoginRequest request) {

        String email = request.email()
                .trim()
                .toLowerCase();

        User user = userRepository
                .findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Invalid email or password"));

        if (user.getStatus() != UserStatus.ACTIVE) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User account is blocked");
        }

        boolean passwordMatches = passwordEncoder.matches(
                request.password(),
                user.getPasswordHash());

        if (!passwordMatches) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid email or password");
        }

        String accessToken = jwtService.generateAccessToken(user);

        String refreshToken = refreshTokenService
                .createRefreshToken(user);

        return new LoginResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                accessToken,
                refreshToken,
                "Bearer",
                900);
    }

    @Transactional
    public RefreshResponse refresh(RefreshRequest request) {

        RefreshToken storedToken = refreshTokenService.validateRefreshToken(
                request.refreshToken());

        User user = storedToken.getUser();

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User account is blocked");
        }

        String newAccessToken = jwtService.generateAccessToken(user);

        String newRefreshToken = refreshTokenService.rotateRefreshToken(
                storedToken);

        return new RefreshResponse(
                newAccessToken,
                newRefreshToken,
                "Bearer",
                900);
    }
}

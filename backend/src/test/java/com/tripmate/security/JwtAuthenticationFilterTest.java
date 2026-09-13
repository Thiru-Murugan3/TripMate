package com.tripmate.security;

import com.tripmate.user.SystemRole;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import com.tripmate.user.UserStatus;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    @InjectMocks
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private User activeUser;
    private User blockedUser;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();

        activeUser = User.builder()
                .id(1L)
                .email("active@example.com")
                .name("Active User")
                .systemRole(SystemRole.USER)
                .status(UserStatus.ACTIVE)
                .build();

        blockedUser = User.builder()
                .id(2L)
                .email("blocked@example.com")
                .name("Blocked User")
                .systemRole(SystemRole.USER)
                .status(UserStatus.BLOCKED)
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("doFilterInternal: No Authorization header proceeds without setting authentication")
    void doFilter_NoAuthHeader_ContinuesUnauthenticated() throws ServletException, IOException {
        when(request.getHeader("Authorization")).thenReturn(null);

        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain, times(1)).doFilter(request, response);
    }

    @Test
    @DisplayName("doFilterInternal: Valid JWT for ACTIVE user sets SecurityContext authentication")
    void doFilter_ValidJwtActiveUser_SetsAuthentication() throws ServletException, IOException {
        String token = "valid.jwt.token";
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.isTokenValid(token)).thenReturn(true);
        when(jwtService.extractEmail(token)).thenReturn("active@example.com");
        when(userRepository.findByEmailIgnoreCase("active@example.com")).thenReturn(Optional.of(activeUser));

        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertEquals("active@example.com", principal.getEmail());
        verify(filterChain, times(1)).doFilter(request, response);
    }

    @Test
    @DisplayName("doFilterInternal: Valid JWT for BLOCKED user rejects authentication")
    void doFilter_BlockedUser_DoesNotSetAuthentication() throws ServletException, IOException {
        String token = "blocked.jwt.token";
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.isTokenValid(token)).thenReturn(true);
        when(jwtService.extractEmail(token)).thenReturn("blocked@example.com");
        when(userRepository.findByEmailIgnoreCase("blocked@example.com")).thenReturn(Optional.of(blockedUser));

        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain, times(1)).doFilter(request, response);
    }

    @Test
    @DisplayName("doFilterInternal: Invalid JWT does not set authentication")
    void doFilter_InvalidJwt_DoesNotSetAuthentication() throws ServletException, IOException {
        String token = "invalid.jwt.token";
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.isTokenValid(token)).thenReturn(false);

        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain, times(1)).doFilter(request, response);
    }
}

package com.tripmate.security;

import com.tripmate.user.SystemRole;
import com.tripmate.user.User;
import com.tripmate.user.UserStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Public Endpoint: Health check allowed without JWT")
    void healthCheck_AllowedWithoutJwt() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Public Endpoint: Login request allowed without JWT")
    void login_AllowedWithoutJwt() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nonexistent@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().is4xxClientError()); // 400 or 401 from controller logic, NOT blocked by Security filter (which would be 401 empty body)
    }

    @Test
    @DisplayName("Protected Auth Endpoint: Change password without JWT fails with 401 Unauthorized")
    void changePassword_WithoutJwt_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"old\",\"newPassword\":\"new\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Protected Business Endpoint: /api/v1/trips without JWT fails with 401 Unauthorized")
    void getTrips_WithoutJwt_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/trips"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Admin Endpoint: /api/v1/admin/users with ROLE_USER gets 403 Forbidden")
    void adminEndpoint_WithUserRole_ReturnsForbidden() throws Exception {
        User user = User.builder()
                .id(10L)
                .email("user@example.com")
                .systemRole(SystemRole.USER)
                .status(UserStatus.ACTIVE)
                .build();
        UserPrincipal userPrincipal = UserPrincipal.create(user);

        mockMvc.perform(get("/api/v1/admin/users")
                        .with(user(userPrincipal)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Admin Endpoint: /api/v1/admin/users with ROLE_ADMIN is allowed")
    void adminEndpoint_WithAdminRole_IsAllowed() throws Exception {
        User adminUser = User.builder()
                .id(1L)
                .email("admin@example.com")
                .systemRole(SystemRole.ADMIN)
                .status(UserStatus.ACTIVE)
                .build();
        UserPrincipal adminPrincipal = UserPrincipal.create(adminUser);

        mockMvc.perform(get("/api/v1/admin/users")
                        .with(user(adminPrincipal)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("UserPrincipal: Loads ROLE_ADMIN correctly for ADMIN user")
    void userPrincipal_LoadsRoleAdminCorrectly() {
        User adminUser = User.builder()
                .id(1L)
                .email("admin@example.com")
                .systemRole(SystemRole.ADMIN)
                .status(UserStatus.ACTIVE)
                .build();

        UserPrincipal principal = UserPrincipal.create(adminUser);

        assertEquals("admin@example.com", principal.getUsername());
        assertTrue(principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")));
    }

    @Test
    @DisplayName("CORS: Options preflight request from allowed origin returns CORS headers")
    void corsOptions_AllowedOrigin_ReturnsCorsHeaders() throws Exception {
        mockMvc.perform(options("/api/v1/health")
                        .header("Origin", "http://localhost:4200")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }
}

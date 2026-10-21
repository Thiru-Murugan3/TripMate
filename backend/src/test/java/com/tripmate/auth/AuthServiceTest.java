package com.tripmate.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripmate.audit.AuditLogService;
import com.tripmate.security.JwtService;
import com.tripmate.user.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
 @Mock UserRepository users;
 @Mock PasswordEncoder passwords;
 @Mock JwtService jwt;
 @Mock RefreshTokenService refresh;
 @Mock AuditLogService audit;
 @InjectMocks AuthService service;
 private User user(){return User.builder().id(10L).email("traveller@example.com").name("Traveller").mobile("9000000000").passwordHash("private-hash").systemRole(SystemRole.USER).status(UserStatus.ACTIVE).build();}
 @Test void loginSuppliesVerifiedIdentityWithoutAnotherUserQuery() throws Exception {
  var user=user();when(users.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));when(passwords.matches("correct",user.getPasswordHash())).thenReturn(true);
  when(jwt.generateAccessToken(user)).thenReturn("access");when(refresh.createRefreshToken(user)).thenReturn("refresh");
  var result=service.login(new LoginRequest("TRAVELLER@example.com","correct"));
  assertEquals(user.getId(),result.user().id());assertEquals(SystemRole.USER,result.user().systemRole());assertEquals(UserStatus.ACTIVE,result.user().status());
  var tree=new ObjectMapper().findAndRegisterModules().valueToTree(result);
  assertEquals("access",tree.path("accessToken").asText());assertEquals("Traveller",tree.path("user").path("name").asText());
  assertFalse(tree.toString().contains("private-hash"));assertFalse(tree.path("user").has("passwordHash"));assertFalse(tree.path("user").has("refreshToken"));
  verify(users,times(1)).findByEmailIgnoreCase(user.getEmail());verifyNoMoreInteractions(users);
 }
 @Test void wrongPasswordNeverIssuesSessionOrProfile() {
  var user=user();when(users.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));when(passwords.matches("wrong",user.getPasswordHash())).thenReturn(false);
  assertThrows(ResponseStatusException.class,()->service.login(new LoginRequest(user.getEmail(),"wrong")));verifyNoInteractions(jwt,refresh);
 }
 @Test void blockedUserNeverIssuesSessionOrProfile() {
  var user=user();user.setStatus(UserStatus.BLOCKED);when(users.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));
  assertThrows(ResponseStatusException.class,()->service.login(new LoginRequest(user.getEmail(),"correct")));verifyNoInteractions(passwords,jwt,refresh);
 }
}

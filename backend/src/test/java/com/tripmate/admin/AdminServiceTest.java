package com.tripmate.admin;

import com.tripmate.booking.BookingRepository;
import com.tripmate.document.DocumentRepository;
import com.tripmate.expense.ExpenseRepository;
import com.tripmate.trip.TripRepository;
import com.tripmate.user.SystemRole;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import com.tripmate.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private DocumentRepository documentRepository;

    @InjectMocks
    private AdminService adminService;

    private User adminUser;
    private User normalUser;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .id(1L)
                .name("System Admin")
                .email("admin@tripmate.com")
                .systemRole(SystemRole.ADMIN)
                .status(UserStatus.ACTIVE)
                .build();

        normalUser = User.builder()
                .id(2L)
                .name("John Doe")
                .email("john@example.com")
                .systemRole(SystemRole.USER)
                .status(UserStatus.ACTIVE)
                .build();
    }

    @Test
    @DisplayName("getAllUsers: Returns list of all registered users")
    void getAllUsers_ReturnsList() {
        when(userRepository.findAll()).thenReturn(List.of(adminUser, normalUser));

        List<AdminUserResponse> result = adminService.getAllUsers();

        assertNotNull(result);
        assertEquals(2, result.size());
        assertEquals("admin@tripmate.com", result.get(0).email());
        assertEquals("john@example.com", result.get(1).email());
    }

    @Test
    @DisplayName("getUserById: Returns user when found")
    void getUserById_Found_ReturnsUser() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(normalUser));

        AdminUserResponse result = adminService.getUserById(2L);

        assertNotNull(result);
        assertEquals(2L, result.id());
        assertEquals("John Doe", result.name());
        assertEquals(UserStatus.ACTIVE, result.status());
    }

    @Test
    @DisplayName("updateUserStatus: Blocks a user successfully")
    void updateUserStatus_BlockUser_Success() {
        UpdateUserStatusRequest request = new UpdateUserStatusRequest(UserStatus.BLOCKED);

        when(userRepository.findById(2L)).thenReturn(Optional.of(normalUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminUserResponse response = adminService.updateUserStatus(2L, request, 1L);

        assertNotNull(response);
        assertEquals(UserStatus.BLOCKED, response.status());
    }

    @Test
    @DisplayName("updateUserStatus: Throws exception when admin tries to block themselves")
    void updateUserStatus_SelfBlock_ThrowsBadRequest() {
        UpdateUserStatusRequest request = new UpdateUserStatusRequest(UserStatus.BLOCKED);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> adminService.updateUserStatus(1L, request, 1L));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Admin cannot block their own account"));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("getPlatformStats: Aggregates counts across platform modules")
    void getPlatformStats_ReturnsAggregatedStats() {
        when(userRepository.count()).thenReturn(10L);
        when(userRepository.countByStatus(UserStatus.ACTIVE)).thenReturn(9L);
        when(userRepository.countByStatus(UserStatus.BLOCKED)).thenReturn(1L);
        when(tripRepository.count()).thenReturn(25L);
        when(bookingRepository.count()).thenReturn(40L);
        when(expenseRepository.count()).thenReturn(150L);
        when(documentRepository.count()).thenReturn(18L);

        AdminStatsResponse stats = adminService.getPlatformStats();

        assertNotNull(stats);
        assertEquals(10L, stats.totalUsers());
        assertEquals(9L, stats.activeUsers());
        assertEquals(1L, stats.blockedUsers());
        assertEquals(25L, stats.totalTrips());
        assertEquals(40L, stats.totalBookings());
        assertEquals(150L, stats.totalExpenses());
        assertEquals(18L, stats.totalDocuments());
    }
}

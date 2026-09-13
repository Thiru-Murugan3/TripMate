package com.tripmate.admin;

import com.tripmate.booking.BookingRepository;
import com.tripmate.document.DocumentRepository;
import com.tripmate.expense.ExpenseRepository;
import com.tripmate.trip.TripRepository;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import com.tripmate.user.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final TripRepository tripRepository;
    private final BookingRepository bookingRepository;
    private final ExpenseRepository expenseRepository;
    private final DocumentRepository documentRepository;

    @Transactional(readOnly = true)
    public List<AdminUserResponse> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(AdminUserResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminUserResponse getUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));
        return AdminUserResponse.from(user);
    }

    @Transactional
    public AdminUserResponse updateUserStatus(Long userId, UpdateUserStatusRequest request, Long currentAdminId) {
        if (userId.equals(currentAdminId) && request.status() == UserStatus.BLOCKED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Admin cannot block their own account");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));

        user.setStatus(request.status());
        User updated = userRepository.save(user);
        return AdminUserResponse.from(updated);
    }

    @Transactional(readOnly = true)
    public AdminStatsResponse getPlatformStats() {
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.countByStatus(UserStatus.ACTIVE);
        long blockedUsers = userRepository.countByStatus(UserStatus.BLOCKED);
        long totalTrips = tripRepository.count();
        long totalBookings = bookingRepository.count();
        long totalExpenses = expenseRepository.count();
        long totalDocuments = documentRepository.count();

        return new AdminStatsResponse(
                totalUsers,
                activeUsers,
                blockedUsers,
                totalTrips,
                totalBookings,
                totalExpenses,
                totalDocuments
        );
    }
}

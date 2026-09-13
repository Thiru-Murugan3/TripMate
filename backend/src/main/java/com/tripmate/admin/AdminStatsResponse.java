package com.tripmate.admin;

public record AdminStatsResponse(
        long totalUsers,
        long activeUsers,
        long blockedUsers,
        long totalTrips,
        long totalBookings,
        long totalExpenses,
        long totalDocuments
) {
}

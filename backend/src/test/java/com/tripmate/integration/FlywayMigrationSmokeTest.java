package com.tripmate.integration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FlywayMigrationSmokeTest {

    @Test
    void allMigrationsApplyToMysqlCompatibleDatabaseAndLeaveColumnsWritable() throws Exception {
        String url = System.getenv("MIGRATION_TEST_DB_URL");
        String username = System.getenv("MIGRATION_TEST_DB_USERNAME");
        String password = System.getenv("MIGRATION_TEST_DB_PASSWORD");
        Assumptions.assumeTrue(url != null && !url.isBlank(), "Migration smoke test runs in CI");

        Flyway flyway = Flyway.configure()
                .dataSource(url, username, password)
                .locations("classpath:db/migration")
                .load();

        assertTrue(flyway.migrate().migrationsExecuted >= 15);
        flyway.validate();

        try (Connection connection = DriverManager.getConnection(url, username, password)) {
            assertEquals("YES", nullableState(connection, "day_id"));
            assertEquals("NO", nullableState(connection, "itinerary_day_id"));
            assertEquals("NO", nullableState(connection, "activity"));
            assertEquals("YES", nullableState(connection, "bookings", "passenger_details"));
            assertEquals("YES", nullableState(connection, "bookings", "pickup_point"));
            assertEquals("YES", nullableState(connection, "bookings", "drop_point"));
            assertTrue(tableExists(connection, "reservation_import_addresses"));
            assertTrue(tableExists(connection, "reservation_email_imports"));
        }
    }

    private String nullableState(Connection connection, String columnName) throws Exception {
        return nullableState(connection, "itinerary_items", columnName);
    }

    private String nullableState(Connection connection, String tableName, String columnName) throws Exception {
        String sql = """
                SELECT IS_NULLABLE
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, tableName);
            statement.setString(2, columnName);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) throw new AssertionError("Missing " + tableName + "." + columnName);
                return result.getString(1);
            }
        }
    }

    private boolean tableExists(Connection connection, String tableName) throws Exception {
        String sql = """
                SELECT COUNT(*)
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, tableName);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getInt(1) == 1;
            }
        }
    }
}

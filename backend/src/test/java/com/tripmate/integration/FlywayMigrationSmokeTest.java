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
    void allMigrationsApplyToTidbAndLeaveCompatibilityColumnsWritable() throws Exception {
        String url = System.getenv("MIGRATION_TEST_DB_URL");
        String username = System.getenv("MIGRATION_TEST_DB_USERNAME");
        String password = System.getenv("MIGRATION_TEST_DB_PASSWORD");
        Assumptions.assumeTrue(url != null && !url.isBlank(), "TiDB migration smoke test runs in CI");

        Flyway flyway = Flyway.configure()
                .dataSource(url, username, password)
                .locations("classpath:db/migration")
                .load();

        assertTrue(flyway.migrate().migrationsExecuted >= 12);
        flyway.validate();

        try (Connection connection = DriverManager.getConnection(url, username, password)) {
            assertEquals("YES", nullableState(connection, "day_id"));
            assertEquals("NO", nullableState(connection, "itinerary_day_id"));
            assertEquals("NO", nullableState(connection, "activity"));
        }
    }

    private String nullableState(Connection connection, String columnName) throws Exception {
        String sql = """
                SELECT IS_NULLABLE
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'itinerary_items'
                  AND COLUMN_NAME = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, columnName);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) throw new AssertionError("Missing itinerary_items." + columnName);
                return result.getString(1);
            }
        }
    }
}

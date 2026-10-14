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
                .target("16").load();

        assertTrue(flyway.migrate().migrationsExecuted >= 16);
        try (Connection c = DriverManager.getConnection(url, username, password); var st = c.createStatement()) {
            st.executeUpdate("INSERT INTO users(id,name,email,password_hash) VALUES (99001,'Migration','migration@example.test','hash')");
            st.executeUpdate("INSERT INTO trips(id,owner_id,name,destination,trip_type,start_date,end_date) VALUES (99001,99001,'Migration','Chennai','FRIENDS','2026-01-01','2026-01-02')");
            st.executeUpdate("INSERT INTO expenses(id,trip_id,paid_by,title,amount,category,expense_date) VALUES (99001,99001,99001,'Legacy',125.50,'FOOD','2026-01-01')");
        }
        flyway = Flyway.configure().dataSource(url, username, password).locations("classpath:db/migration").load();
        assertTrue(flyway.migrate().migrationsExecuted >= 1);
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
            assertTrue(tableExists(connection, "flight_tracking"));
            assertTrue(tableExists(connection, "flight_subscriptions"));
            assertTrue(tableExists(connection, "flight_api_budget"));
            assertStarterCatalogue(connection);
            assertEquals("NO", nullableState(connection, "expenses", "original_amount"));
            try (var st = connection.createStatement(); var rows = st.executeQuery("SELECT original_currency,original_amount,exchange_rate FROM expenses WHERE id=99001")) {
                assertTrue(rows.next());
                assertEquals("INR", rows.getString(1));
                assertEquals(0, new java.math.BigDecimal("125.50").compareTo(rows.getBigDecimal(2)));
                assertEquals(0, java.math.BigDecimal.ONE.compareTo(rows.getBigDecimal(3)));
            }
        }
    }

    private void assertStarterCatalogue(Connection connection) throws Exception {
        try (var statement = connection.createStatement()) {
            try (var rows = statement.executeQuery("""
                    SELECT city, COUNT(*) AS total,
                           SUM(item_type = 'ACTIVITY') AS activities
                    FROM discovery_items WHERE external_id LIKE 'suttru:%'
                    GROUP BY city ORDER BY city
                    """)) {
                for (String city : new String[]{"Chennai", "Jaipur", "Mysuru"}) {
                    assertTrue(rows.next());
                    assertEquals(city, rows.getString("city"));
                    assertEquals(3, rows.getInt("total"));
                    assertEquals(1, rows.getInt("activities"));
                }
                assertTrue(!rows.next());
            }
            try (var rows = statement.executeQuery("""
                    SELECT COUNT(*) FROM discovery_items
                    WHERE external_id LIKE 'suttru:%'
                      AND price_status = 'UNKNOWN' AND base_price IS NULL
                    """)) {
                rows.next();
                assertEquals(7, rows.getInt(1));
            }
            try (var rows = statement.executeQuery("""
                    SELECT COUNT(*) FROM discovery_price_options p
                    JOIN discovery_items i ON i.id = p.discovery_item_id
                    WHERE i.external_id LIKE 'suttru:%'
                      AND p.source_url = 'https://www.mysuruzoo.info/visit'
                      AND p.price_type = 'PER_PERSON' AND p.currency = 'INR'
                      AND p.last_verified_at < p.expires_at
                      AND ((p.amount > 0 AND p.price_status = 'VERIFIED')
                        OR (p.amount = 0 AND p.price_status = 'FREE'))
                    """)) {
                rows.next();
                assertEquals(5, rows.getInt(1));
            }
            try (var rows = statement.executeQuery("""
                    SELECT base_price FROM discovery_items
                    WHERE external_id = 'suttru:mysuru-zoo'
                    """)) {
                assertTrue(rows.next());
                assertEquals(0, new java.math.BigDecimal("120").compareTo(rows.getBigDecimal(1)));
            }
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

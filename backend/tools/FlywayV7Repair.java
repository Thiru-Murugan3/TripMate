import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public final class FlywayV7Repair {

    private static final int PREVIOUS_APPLIED_CHECKSUM = 1865009708;
    private static final int CURRENT_V7_CHECKSUM = -1620419020;

    private FlywayV7Repair() {
    }

    public static void main(String[] args) {
        String url = requireEnv("DB_URL");
        String user = requireEnv("DB_USERNAME");
        String password = System.getenv("DB_PASSWORD");

        if (password == null) {
            password = "";
        }

        try {
            Class.forName("com.mysql.cj.jdbc.Driver");

            try (Connection connection = DriverManager.getConnection(url, user, password)) {
                Integer appliedChecksum = findAppliedV7Checksum(connection);

                if (appliedChecksum == null) {
                    System.out.println("Flyway V7 has not been applied yet. No repair is needed.");
                    return;
                }

                if (appliedChecksum == CURRENT_V7_CHECKSUM) {
                    System.out.println("Flyway V7 checksum is already correct.");
                    return;
                }

                if (appliedChecksum != PREVIOUS_APPLIED_CHECKSUM) {
                    fail(
                            "Flyway V7 has an unexpected checksum (" + appliedChecksum + "). " +
                            "TripMate will not change flyway_schema_history automatically."
                    );
                }

                verifyExpectedV7Schema(connection);

                int updated = updateChecksum(connection);
                if (updated != 1) {
                    fail("Flyway V7 checksum repair did not update exactly one history row.");
                }

                System.out.println(
                        "Flyway V7 repair SUCCESS. History checksum updated from " +
                        PREVIOUS_APPLIED_CHECKSUM + " to " + CURRENT_V7_CHECKSUM + "."
                );
            }
        } catch (ClassNotFoundException ex) {
            fail("MySQL Connector/J was not available to the repair utility.");
        } catch (SQLException ex) {
            fail("Unable to verify/repair Flyway V7: " + safeSqlMessage(ex));
        }
    }

    private static Integer findAppliedV7Checksum(Connection connection) throws SQLException {
        String sql = """
                SELECT checksum
                FROM flyway_schema_history
                WHERE version = '7'
                  AND success = 1
                ORDER BY installed_rank DESC
                LIMIT 1
                """;

        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {
            if (!resultSet.next()) {
                return null;
            }

            int checksum = resultSet.getInt(1);
            return resultSet.wasNull() ? null : checksum;
        }
    }

    private static void verifyExpectedV7Schema(Connection connection) throws SQLException {
        int inviterColumn = count(
                connection,
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'trip_invitations'
                  AND COLUMN_NAME = 'inviter_id'
                  AND IS_NULLABLE = 'NO'
                  AND DATA_TYPE = 'bigint'
                """
        );

        int legacyColumn = count(
                connection,
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'trip_invitations'
                  AND COLUMN_NAME = 'invited_by'
                """
        );

        int inviterForeignKey = count(
                connection,
                """
                SELECT COUNT(*)
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'trip_invitations'
                  AND COLUMN_NAME = 'inviter_id'
                  AND REFERENCED_TABLE_NAME = 'users'
                  AND REFERENCED_COLUMN_NAME = 'id'
                """
        );

        if (inviterColumn != 1 || legacyColumn != 0 || inviterForeignKey < 1) {
            fail(
                    "Database schema does not match the expected V7 result. " +
                    "No Flyway history was changed. " +
                    "Expected: inviter_id BIGINT NOT NULL, no invited_by column, and inviter_id -> users(id) foreign key."
            );
        }
    }

    private static int count(Connection connection, String sql) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {
            resultSet.next();
            return resultSet.getInt(1);
        }
    }

    private static int updateChecksum(Connection connection) throws SQLException {
        String sql = """
                UPDATE flyway_schema_history
                SET checksum = ?
                WHERE version = '7'
                  AND success = 1
                  AND checksum = ?
                """;

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, CURRENT_V7_CHECKSUM);
            statement.setInt(2, PREVIOUS_APPLIED_CHECKSUM);
            return statement.executeUpdate();
        }
    }

    private static String requireEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            fail(name + " is not configured in backend/.env.");
        }
        return value;
    }

    private static String safeSqlMessage(SQLException ex) {
        String message = ex.getMessage();
        return message == null || message.isBlank()
                ? ex.getClass().getSimpleName()
                : message.replaceAll("(?i)password=[^&\\s]+", "password=<redacted>");
    }

    private static void fail(String message) {
        System.err.println("Flyway V7 repair FAILED: " + message);
        System.exit(1);
    }
}

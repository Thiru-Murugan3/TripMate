package com.tripmate.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Repairs booking import columns for legacy databases whose Flyway history was
 * recorded before every V13 column was created.
 *
 * <p>V14 remains the canonical migration. This startup guard is intentionally
 * idempotent and also protects deployments where Flyway was disabled externally.</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class BookingSchemaStartupRepair implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BookingSchemaStartupRepair.class);
    private static final String COLUMN_COUNT_SQL = """
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE (
                    UPPER(TABLE_SCHEMA) = UPPER(DATABASE())
                    OR UPPER(TABLE_CATALOG) = UPPER(DATABASE())
                  )
              AND UPPER(TABLE_NAME) = 'BOOKINGS'
              AND UPPER(COLUMN_NAME) = UPPER('%s')
            """;

    private static final List<RequiredColumn> REQUIRED_COLUMNS = List.of(
            new RequiredColumn("passenger_details",
                    "ALTER TABLE bookings ADD COLUMN passenger_details TEXT NULL"),
            new RequiredColumn("pickup_point",
                    "ALTER TABLE bookings ADD COLUMN pickup_point VARCHAR(255) NULL"),
            new RequiredColumn("drop_point",
                    "ALTER TABLE bookings ADD COLUMN drop_point VARCHAR(255) NULL")
    );

    private final JdbcTemplate jdbcTemplate;

    public BookingSchemaStartupRepair(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (RequiredColumn column : REQUIRED_COLUMNS) {
            Integer count = jdbcTemplate.queryForObject(
                    COLUMN_COUNT_SQL.formatted(column.name()),
                    Integer.class
            );
            if (count == null || count == 0) {
                log.warn("Repairing missing bookings.{} column", column.name());
                jdbcTemplate.execute(column.ddl());
            }
        }
    }

    private record RequiredColumn(String name, String ddl) {
    }
}

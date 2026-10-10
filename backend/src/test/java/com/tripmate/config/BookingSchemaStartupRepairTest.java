package com.tripmate.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingSchemaStartupRepairTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void addsOnlyTheMissingBookingColumn() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class)))
                .thenReturn(1, 1, 0);

        new BookingSchemaStartupRepair(jdbcTemplate).run(null);

        verify(jdbcTemplate).execute(
                "ALTER TABLE bookings ADD COLUMN drop_point VARCHAR(255) NULL"
        );
        verify(jdbcTemplate, never()).execute(
                "ALTER TABLE bookings ADD COLUMN passenger_details TEXT NULL"
        );
        verify(jdbcTemplate, never()).execute(
                "ALTER TABLE bookings ADD COLUMN pickup_point VARCHAR(255) NULL"
        );
    }

    @Test
    void makesNoSchemaChangesWhenAllColumnsExist() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class)))
                .thenReturn(1, 1, 1);

        new BookingSchemaStartupRepair(jdbcTemplate).run(null);

        verify(jdbcTemplate, never()).execute(anyString());
    }
}

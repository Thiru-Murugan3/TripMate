package com.tripmate.flight;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.*;

/** Reserve before contacting the provider; failed calls still consume the allowance. */
@Service
public class FlightApiBudget {
    private final JdbcTemplate jdbc;
    private final int limit;
    public FlightApiBudget(JdbcTemplate jdbc, @Value("${flight-alerts.daily-request-limit:200}") int limit) {
        this.jdbc = jdbc; this.limit = limit;
    }
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public boolean reserve() {
        if (limit <= 0) return false;
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return jdbc.update("""
                UPDATE flight_api_budget
                SET requests = CASE WHEN budget_date = ? THEN requests + 1 ELSE 1 END, budget_date = ?
                WHERE id = 1 AND (budget_date <> ? OR requests < ?)
                """, today,today,today,limit) == 1;
    }
}

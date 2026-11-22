package com.tripmate.flight;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.time.LocalDate;
import java.time.ZoneOffset;
import static org.junit.jupiter.api.Assertions.*;

class FlightApiBudgetTest {
    @Test void capsCallsAndResetsOnUtcDayChange() {
        var jdbc = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:flightbudget;DB_CLOSE_DELAY=-1","sa",""));
        jdbc.execute("CREATE TABLE flight_api_budget (id INT PRIMARY KEY, budget_date DATE, requests INT)");
        jdbc.update("INSERT INTO flight_api_budget VALUES (1,?,0)",LocalDate.now(ZoneOffset.UTC));
        var budget = new FlightApiBudget(jdbc,2);
        assertTrue(budget.reserve()); assertTrue(budget.reserve()); assertFalse(budget.reserve());
        jdbc.update("UPDATE flight_api_budget SET budget_date=?",LocalDate.now(ZoneOffset.UTC).minusDays(1));
        assertTrue(budget.reserve()); assertEquals(1,jdbc.queryForObject("SELECT requests FROM flight_api_budget",Integer.class));
        assertFalse(new FlightApiBudget(jdbc,0).reserve());
    }
}

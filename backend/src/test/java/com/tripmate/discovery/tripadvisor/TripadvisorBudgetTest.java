package com.tripmate.discovery.tripadvisor;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.embedded.*;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.server.ResponseStatusException;
import javax.sql.DataSource;
import java.time.LocalDate;
import java.time.ZoneOffset;
import static org.junit.jupiter.api.Assertions.*;

@SpringJUnitConfig(TripadvisorBudgetTest.Config.class)
class TripadvisorBudgetTest {
    @Configuration @EnableTransactionManagement
    static class Config {
        @Bean DataSource dataSource() { return new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2)
                .addScript("db/migration/V19__tripadvisor_usage.sql").build(); }
        @Bean JdbcTemplate jdbc(DataSource ds) { return new JdbcTemplate(ds); }
        @Bean PlatformTransactionManager transactions(DataSource ds) { return new DataSourceTransactionManager(ds); }
        @Bean TripadvisorBudget budget(JdbcTemplate jdbc) { return new TripadvisorBudget(jdbc, 2, 3); }
    }
    @Autowired TripadvisorBudget budget; @Autowired JdbcTemplate jdbc;
    @BeforeEach void reset() { jdbc.update("UPDATE tripadvisor_usage SET usage_day='', usage_month='', daily_calls=0, monthly_calls=0"); }
    @Test void committedCountsSurviveNewServiceAndEnforceDailyCap() {
        budget.reserve(); budget.reserve();
        assertThrows(ResponseStatusException.class, budget::reserve);
        assertEquals(2, jdbc.queryForObject("SELECT daily_calls FROM tripadvisor_usage", Integer.class));
        assertThrows(ResponseStatusException.class, new TripadvisorBudget(jdbc, 2, 3)::reserve);
    }
    @Test void dayRollsOverButMonthlyCapRemains() {
        String today = LocalDate.now(ZoneOffset.UTC).toString();
        jdbc.update("UPDATE tripadvisor_usage SET usage_day='2000-01-01', usage_month=?, daily_calls=2, monthly_calls=2", today.substring(0,7));
        budget.reserve(); assertThrows(ResponseStatusException.class, budget::reserve);
        assertEquals(1, jdbc.queryForObject("SELECT daily_calls FROM tripadvisor_usage", Integer.class));
    }
    @Test void concurrentReservationsCannotExceedLimit() throws Exception {
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(6)) {
            var tasks = new java.util.ArrayList<java.util.concurrent.Callable<Boolean>>();
            for (int i=0;i<12;i++) tasks.add(() -> { try { budget.reserve(); return true; } catch (ResponseStatusException ex) { return false; } });
            int success=0; for (var result:executor.invokeAll(tasks)) if (result.get()) success++;
            assertEquals(2, success);
        }
    }
}

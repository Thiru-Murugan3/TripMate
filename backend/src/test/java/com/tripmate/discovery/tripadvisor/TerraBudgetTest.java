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
import javax.sql.DataSource;
import static org.junit.jupiter.api.Assertions.*;

@SpringJUnitConfig(TerraBudgetTest.Config.class)
class TerraBudgetTest {
    @Configuration @EnableTransactionManagement static class Config {
        @Bean DataSource ds() { return new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2)
          .addScript("db/migration/V19__tripadvisor_usage.sql").addScript("db/migration/V20__tripadvisor_terra_entity_budget.sql").build(); }
        @Bean JdbcTemplate jdbc(DataSource ds) { return new JdbcTemplate(ds); }
        @Bean PlatformTransactionManager transactions(DataSource ds) { return new DataSourceTransactionManager(ds); }
        @Bean TripadvisorBudget budget(JdbcTemplate jdbc) { return new TripadvisorBudget(jdbc,100,4000,12); }
    }
    @Autowired TripadvisorBudget budget; @Autowired JdbcTemplate jdbc;
    @BeforeEach void reset() {
        jdbc.update("UPDATE tripadvisor_usage SET usage_day='',usage_month='',daily_calls=0,monthly_calls=0");
        jdbc.update("UPDATE tripadvisor_terra_usage SET reserved_entities=0");
    }
    @Test void searchReservesTenEntitiesAndMonthlyRolloverDoesNotResetLifetimeBudget() {
        budget.reserveTerra(10);budget.reserveTerra(1);budget.reserveTerra(1);
        jdbc.update("UPDATE tripadvisor_usage SET usage_day='',usage_month=''");
        assertThrows(TripadvisorFailure.class,()->budget.reserveTerra(1));
        assertEquals(12L,jdbc.queryForObject("SELECT reserved_entities FROM tripadvisor_terra_usage",Long.class));
    }
    @Test void competingRequestsCannotExceedEntityAllowance() throws Exception {
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(4)) {
            var tasks=new java.util.ArrayList<java.util.concurrent.Callable<Boolean>>();
            for(int i=0;i<6;i++)tasks.add(()->{try{budget.reserveTerra(10);return true;}catch(TripadvisorFailure e){return false;}});
            int success=0;for(var result:pool.invokeAll(tasks))if(result.get())success++;
            assertEquals(1,success);assertEquals(10L,jdbc.queryForObject("SELECT reserved_entities FROM tripadvisor_terra_usage",Long.class));
        }
    }
    @Test void legacyCallsDoNotConsumeTerraEntitiesAndDefaultIsDisabled() {
        budget.reserve();assertEquals(0L,jdbc.queryForObject("SELECT reserved_entities FROM tripadvisor_terra_usage",Long.class));
        var disabled=new TripadvisorBudget(jdbc,100,4000,0);assertFalse(disabled.terraConfigured());
        assertThrows(TripadvisorFailure.class,()->disabled.reserveTerra(1));
    }
}

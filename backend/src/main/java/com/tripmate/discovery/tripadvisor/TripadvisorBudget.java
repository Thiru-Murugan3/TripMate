package com.tripmate.discovery.tripadvisor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.LocalDate;
import java.time.ZoneOffset;

/** Stores request counts only, never Tripadvisor content. Committed before each outbound call. */
@Service
public class TripadvisorBudget {
    private final JdbcTemplate jdbc;
    private final int dailyLimit;
    private final int monthlyLimit;
    private final long terraEntityLimit;

    @org.springframework.beans.factory.annotation.Autowired
    public TripadvisorBudget(JdbcTemplate jdbc,
            @Value("${discovery.tripadvisor.daily-limit:100}") int dailyLimit,
            @Value("${discovery.tripadvisor.monthly-limit:4000}") int monthlyLimit,
            @Value("${discovery.tripadvisor.terra-entity-limit:0}") long terraEntityLimit) {
        this.jdbc = jdbc;
        this.dailyLimit = Math.max(0, dailyLimit);
        this.monthlyLimit = Math.max(0, monthlyLimit);
        this.terraEntityLimit = Math.max(0, terraEntityLimit);
    }

    TripadvisorBudget(JdbcTemplate jdbc, int dailyLimit, int monthlyLimit) {
        this(jdbc, dailyLimit, monthlyLimit, 0);
    }
    public boolean terraConfigured() { return terraEntityLimit > 0; }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reserve() { reserveRequest(0); }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reserveTerra(int maximumEntities) {
        if (maximumEntities < 1 || maximumEntities > 20) throw new IllegalArgumentException("Invalid entity reservation");
        reserveRequest(maximumEntities);
    }

    private void reserveRequest(int maximumEntities) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        String day = today.toString(), month = day.substring(0, 7);
        var rows = jdbc.queryForList("SELECT usage_day, usage_month, daily_calls, monthly_calls FROM tripadvisor_usage WHERE id=1 FOR UPDATE");
        if (rows.size() != 1) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Tripadvisor usage controls unavailable");
        var row = rows.get(0);
        int daily = day.equals(row.get("usage_day")) ? ((Number) row.get("daily_calls")).intValue() : 0;
        int monthly = month.equals(row.get("usage_month")) ? ((Number) row.get("monthly_calls")).intValue() : 0;
        if (daily >= dailyLimit || monthly >= monthlyLimit)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Tripadvisor usage limit reached. Your saved places remain available.");
        if (maximumEntities > 0) {
            var entities = jdbc.queryForList("SELECT reserved_entities FROM tripadvisor_terra_usage WHERE id=1 FOR UPDATE");
            if (entities.size() != 1) throw new TripadvisorFailure(HttpStatus.SERVICE_UNAVAILABLE, "USAGE_UNAVAILABLE", "Terra usage controls unavailable");
            long reserved = ((Number)entities.get(0).get("reserved_entities")).longValue();
            if (terraEntityLimit == 0 || reserved > terraEntityLimit - maximumEntities)
                throw new TripadvisorFailure(HttpStatus.TOO_MANY_REQUESTS, "TERRA_ENTITY_LIMIT", "Suttru's configured Terra entity budget is exhausted");
            jdbc.update("UPDATE tripadvisor_terra_usage SET reserved_entities=? WHERE id=1", reserved + maximumEntities);
        }
        jdbc.update("UPDATE tripadvisor_usage SET usage_day=?, usage_month=?, daily_calls=?, monthly_calls=? WHERE id=1",
                day, month, daily + 1, monthly + 1);
    }
}

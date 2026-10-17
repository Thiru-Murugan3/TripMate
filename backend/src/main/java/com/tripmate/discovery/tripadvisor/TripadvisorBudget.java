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

    public TripadvisorBudget(JdbcTemplate jdbc,
            @Value("${discovery.tripadvisor.daily-limit:100}") int dailyLimit,
            @Value("${discovery.tripadvisor.monthly-limit:4000}") int monthlyLimit) {
        this.jdbc = jdbc;
        this.dailyLimit = Math.max(0, dailyLimit);
        this.monthlyLimit = Math.max(0, monthlyLimit);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reserve() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        String day = today.toString(), month = day.substring(0, 7);
        var rows = jdbc.queryForList("SELECT usage_day, usage_month, daily_calls, monthly_calls FROM tripadvisor_usage WHERE id=1 FOR UPDATE");
        if (rows.size() != 1) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Tripadvisor usage controls unavailable");
        var row = rows.get(0);
        int daily = day.equals(row.get("usage_day")) ? ((Number) row.get("daily_calls")).intValue() : 0;
        int monthly = month.equals(row.get("usage_month")) ? ((Number) row.get("monthly_calls")).intValue() : 0;
        if (daily >= dailyLimit || monthly >= monthlyLimit)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Tripadvisor usage limit reached. Your saved places remain available.");
        jdbc.update("UPDATE tripadvisor_usage SET usage_day=?, usage_month=?, daily_calls=?, monthly_calls=? WHERE id=1",
                day, month, daily + 1, monthly + 1);
    }
}

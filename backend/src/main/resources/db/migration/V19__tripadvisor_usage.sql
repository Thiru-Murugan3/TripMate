-- Durable account-wide request counts; no third-party content is stored.
CREATE TABLE tripadvisor_usage (
    id INT NOT NULL PRIMARY KEY,
    usage_day VARCHAR(10) NOT NULL,
    usage_month VARCHAR(7) NOT NULL,
    daily_calls INT NOT NULL DEFAULT 0,
    monthly_calls INT NOT NULL DEFAULT 0
);
INSERT INTO tripadvisor_usage (id, usage_day, usage_month, daily_calls, monthly_calls)
VALUES (1, '', '', 0, 0);

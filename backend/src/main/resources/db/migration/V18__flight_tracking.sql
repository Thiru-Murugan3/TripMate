CREATE TABLE flight_tracking (
    booking_id BIGINT NOT NULL PRIMARY KEY,
    ident VARCHAR(12) NOT NULL,
    airline_code VARCHAR(3) NOT NULL,
    flight_number VARCHAR(5) NOT NULL,
    departure_date DATE NOT NULL,
    origin VARCHAR(4) NOT NULL,
    destination VARCHAR(4) NOT NULL,
    departure_zone VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    window_start DATETIME(6) NOT NULL,
    window_end DATETIME(6) NOT NULL,
    next_poll DATETIME(6) NOT NULL,
    last_checked DATETIME(6) NULL,
    provider_flight_id VARCHAR(180) NULL,
    booking_fingerprint VARCHAR(64) NOT NULL,
    snapshot TEXT NULL,
    message VARCHAR(255) NULL,
    CONSTRAINT fk_flight_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    INDEX ix_flight_poll (enabled, next_poll)
);
CREATE TABLE flight_subscriptions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    CONSTRAINT uk_flight_subscriber UNIQUE (booking_id, user_id),
    CONSTRAINT fk_flight_subscription FOREIGN KEY (booking_id) REFERENCES flight_tracking(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_flight_subscriber FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE flight_api_budget (
    id INT NOT NULL PRIMARY KEY,
    budget_date DATE NOT NULL,
    requests INT NOT NULL DEFAULT 0
);
INSERT INTO flight_api_budget (id, budget_date, requests) VALUES (1, '2000-01-01', 0);

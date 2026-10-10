CREATE TABLE IF NOT EXISTS reservation_import_addresses (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    import_token VARCHAR(64) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_reservation_import_address_user UNIQUE (user_id),
    CONSTRAINT uk_reservation_import_address_token UNIQUE (import_token),
    CONSTRAINT fk_reservation_import_address_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reservation_email_imports (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    trip_id BIGINT NULL,
    booking_id BIGINT NULL,
    message_id VARCHAR(255) NOT NULL,
    provider_uuid VARCHAR(100) NULL,
    sender_address VARCHAR(320) NULL,
    recipient_address VARCHAR(320) NOT NULL,
    subject VARCHAR(500) NULL,
    raw_text LONGTEXT NULL,
    draft_json LONGTEXT NULL,
    attachment_count INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'NEEDS_REVIEW',
    error_message VARCHAR(1000) NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_reservation_email_message UNIQUE (message_id),
    CONSTRAINT fk_reservation_email_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_reservation_email_trip
        FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE SET NULL,
    CONSTRAINT fk_reservation_email_booking
        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL,
    INDEX idx_reservation_email_user_status (user_id, status, received_at)
);

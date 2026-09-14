ALTER TABLE bookings
    ADD COLUMN refundable BOOLEAN NULL,
    ADD COLUMN cancellation_reason VARCHAR(500) NULL,
    ADD COLUMN cancelled_at DATETIME NULL;

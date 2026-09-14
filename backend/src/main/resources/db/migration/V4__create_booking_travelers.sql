CREATE TABLE booking_travelers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    traveler_order INT NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    gender VARCHAR(24) NOT NULL,
    date_of_birth DATE NOT NULL,
    email VARCHAR(180),
    mobile VARCHAR(20),
    CONSTRAINT fk_booking_travelers_booking
        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    CONSTRAINT uk_booking_traveler_order UNIQUE (booking_id, traveler_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

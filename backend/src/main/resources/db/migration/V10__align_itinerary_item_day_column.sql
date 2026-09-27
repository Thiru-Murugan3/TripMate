-- Older TripMate databases use itinerary_day_id while the first Flyway schema
-- introduced day_id. Keep the legacy column as the canonical JPA mapping and
-- migrate values created with either schema without deleting user data.
SET @dbname = DATABASE();
SET @tablename = 'itinerary_items';
SET @columnname = 'itinerary_day_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE itinerary_items ADD COLUMN itinerary_day_id BIGINT NULL'
));
PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE itinerary_items
SET itinerary_day_id = day_id
WHERE itinerary_day_id IS NULL
  AND day_id IS NOT NULL;

ALTER TABLE itinerary_items
    MODIFY COLUMN itinerary_day_id BIGINT NOT NULL;

-- Hibernate no longer writes this compatibility column. It must remain
-- nullable for installations initially created from V1.
ALTER TABLE itinerary_items
    MODIFY COLUMN day_id BIGINT NULL;


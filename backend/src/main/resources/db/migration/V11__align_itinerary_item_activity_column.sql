-- The original TiDB design called the itinerary title "activity". Current
-- TripMate uses "title", but writes both columns for backwards compatibility.
SET @dbname = DATABASE();
SET @tablename = 'itinerary_items';
SET @columnname = 'activity';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE itinerary_items ADD COLUMN activity VARCHAR(180) NULL'
));
PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE itinerary_items
SET activity = title
WHERE activity IS NULL
  AND title IS NOT NULL;

ALTER TABLE itinerary_items
    MODIFY COLUMN activity VARCHAR(180) NOT NULL;


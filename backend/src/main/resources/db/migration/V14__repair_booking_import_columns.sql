-- Repair databases where an earlier V13 was recorded before all booking import
-- columns were created. Keep this migration idempotent for mixed legacy schemas.
SET @dbname = DATABASE();
SET @tablename = 'bookings';

SET @columnname = 'passenger_details';
SET @preparedStatement = (SELECT IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ),
  'SELECT 1',
  'ALTER TABLE bookings ADD COLUMN passenger_details TEXT NULL'
));
PREPARE repairBookingColumn FROM @preparedStatement;
EXECUTE repairBookingColumn;
DEALLOCATE PREPARE repairBookingColumn;

SET @columnname = 'pickup_point';
SET @preparedStatement = (SELECT IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ),
  'SELECT 1',
  'ALTER TABLE bookings ADD COLUMN pickup_point VARCHAR(255) NULL'
));
PREPARE repairBookingColumn FROM @preparedStatement;
EXECUTE repairBookingColumn;
DEALLOCATE PREPARE repairBookingColumn;

SET @columnname = 'drop_point';
SET @preparedStatement = (SELECT IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ),
  'SELECT 1',
  'ALTER TABLE bookings ADD COLUMN drop_point VARCHAR(255) NULL'
));
PREPARE repairBookingColumn FROM @preparedStatement;
EXECUTE repairBookingColumn;
DEALLOCATE PREPARE repairBookingColumn;

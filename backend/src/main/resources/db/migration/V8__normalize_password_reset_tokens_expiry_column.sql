-- Normalize legacy password_reset_tokens schema.
-- Older local databases used expires_at, while the current entity and V1 schema use expiry_date.
-- This migration safely removes the legacy expires_at column if present.

SET @tripmate_schema = DATABASE();

SET @has_expires_at = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @tripmate_schema
      AND TABLE_NAME = 'password_reset_tokens'
      AND COLUMN_NAME = 'expires_at'
);

SET @sql = IF(
    @has_expires_at > 0,
    'ALTER TABLE password_reset_tokens DROP COLUMN expires_at',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

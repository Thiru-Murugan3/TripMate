-- Normalize legacy trip_invitations schema.
-- Older local databases used invited_by, while the current entity and V1 schema use inviter_id.
-- This migration preserves existing data, removes the legacy required column, and ensures
-- the current inviter_id relationship is valid.

SET @tripmate_schema = DATABASE();

SET @has_invited_by = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @tripmate_schema
      AND TABLE_NAME = 'trip_invitations'
      AND COLUMN_NAME = 'invited_by'
);

SET @has_inviter_id = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @tripmate_schema
      AND TABLE_NAME = 'trip_invitations'
      AND COLUMN_NAME = 'inviter_id'
);

SET @sql = IF(
    @has_inviter_id = 0,
    'ALTER TABLE trip_invitations ADD COLUMN inviter_id BIGINT NULL AFTER trip_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    @has_invited_by > 0,
    'UPDATE trip_invitations SET inviter_id = invited_by WHERE inviter_id IS NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @legacy_inviter_fk = (
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = @tripmate_schema
      AND TABLE_NAME = 'trip_invitations'
      AND COLUMN_NAME = 'invited_by'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);

SET @sql = IF(
    @legacy_inviter_fk IS NOT NULL,
    CONCAT('ALTER TABLE trip_invitations DROP FOREIGN KEY ', @legacy_inviter_fk),
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    @has_invited_by > 0,
    'ALTER TABLE trip_invitations DROP COLUMN invited_by',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE trip_invitations
    MODIFY COLUMN inviter_id BIGINT NOT NULL;

SET @has_inviter_fk = (
    SELECT COUNT(*)
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = @tripmate_schema
      AND TABLE_NAME = 'trip_invitations'
      AND COLUMN_NAME = 'inviter_id'
      AND REFERENCED_TABLE_NAME = 'users'
      AND REFERENCED_COLUMN_NAME = 'id'
);

SET @sql = IF(
    @has_inviter_fk = 0,
    'ALTER TABLE trip_invitations ADD CONSTRAINT fk_trip_invitations_inviter_v7 FOREIGN KEY (inviter_id) REFERENCES users (id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

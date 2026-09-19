-- Remove the legacy column left by an earlier password-reset schema.
-- The application and current schema use expiry_date. Keeping expires_at as
-- NOT NULL makes every new password reset token insert fail.
ALTER TABLE password_reset_tokens
    DROP COLUMN IF EXISTS expires_at;

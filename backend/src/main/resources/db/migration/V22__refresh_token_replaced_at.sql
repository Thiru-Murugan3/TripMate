-- When a refresh token is rotated, remember when it was replaced. A client whose refresh
-- response was lost (e.g. the server was waking from sleep) can then retry with the old
-- token for a short grace period instead of being signed out. Logout never sets this.
ALTER TABLE refresh_tokens ADD COLUMN replaced_at DATETIME NULL;

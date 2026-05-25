-- Profile pictures on every user account.
-- Stored as BLOB on the row itself so a single SELECT pulls everything
-- the UI needs. avatar_updated_at acts as a cache-bust token for
-- /api/auth/avatar/:userId so clients don't see stale photos after a
-- replace.

ALTER TABLE users ADD COLUMN avatar_data BLOB;
ALTER TABLE users ADD COLUMN avatar_mime TEXT;
ALTER TABLE users ADD COLUMN avatar_updated_at TEXT;

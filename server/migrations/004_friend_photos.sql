-- Phase 4: each friend can have multiple photos, navigated via a carousel.
-- Move the existing single-photo BLOBs into the new friend_photos table at
-- position 1, then drop the old columns from friends.
--
-- Position is 1-based and unique per friend. Lower positions show first.

CREATE TABLE friend_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id   TEXT NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  photo_data  BLOB NOT NULL,
  photo_mime  TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (friend_id, position)
);
CREATE INDEX idx_friend_photos_lookup ON friend_photos(friend_id, position);

-- Forward-migrate the legacy single-photo BLOBs.
INSERT INTO friend_photos (friend_id, position, photo_data, photo_mime, uploaded_at)
SELECT id, 1, photo_data, photo_mime, COALESCE(photo_updated_at, datetime('now'))
FROM friends
WHERE photo_data IS NOT NULL AND photo_mime IS NOT NULL;

-- Drop the legacy columns. SQLite (and libSQL) supports DROP COLUMN.
ALTER TABLE friends DROP COLUMN photo_data;
ALTER TABLE friends DROP COLUMN photo_mime;
ALTER TABLE friends DROP COLUMN photo_updated_at;

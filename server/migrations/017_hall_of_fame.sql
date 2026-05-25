-- Hall of Fame: a feed of user-uploaded images / videos / YouTube embeds.
-- One row per post. Author = users.id. Anyone can upload (logged in),
-- only the owner or an admin can delete.
--
-- kind decides how the row's data is interpreted:
--   image / video  → blob_data + blob_mime hold the file bytes
--   youtube        → youtube_id holds the parsed 11-char video id
--                    (blob_data and blob_mime are NULL)

CREATE TABLE hall_of_fame_posts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('image', 'video', 'youtube')),
  blob_data   BLOB,
  blob_mime   TEXT,
  youtube_id  TEXT,
  caption     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_hof_user ON hall_of_fame_posts(user_id);
CREATE INDEX idx_hof_created ON hall_of_fame_posts(created_at DESC);

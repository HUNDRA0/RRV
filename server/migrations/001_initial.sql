-- Initial schema: friends, predictions, admin_sessions.
-- Photos live as BLOBs alongside their friend row so the database is the
-- single source of truth — no separate filesystem for uploaded images.

CREATE TABLE friends (
  id                TEXT PRIMARY KEY,                     -- stable lowercase id, e.g. 'mario'
  name              TEXT NOT NULL,                        -- display name (mutable by admin)
  rank              INTEGER NOT NULL UNIQUE,              -- 1..15, drives the #N badge
  tier              TEXT NOT NULL CHECK (tier IN ('s', 'a', 'i')),
  street            TEXT NOT NULL,
  postcode          TEXT NOT NULL,
  city              TEXT NOT NULL,
  note              TEXT NOT NULL DEFAULT '',
  photo_data        BLOB,                                  -- raw bytes, nullable
  photo_mime        TEXT,                                  -- e.g. 'image/jpeg'
  photo_updated_at  TEXT,                                  -- cache-bust token, also null when no photo
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE predictions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  guesser_name    TEXT NOT NULL,
  friend_id       TEXT NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  prediction_text TEXT NOT NULL,
  marked_correct  INTEGER NOT NULL DEFAULT 0 CHECK (marked_correct IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_predictions_friend ON predictions(friend_id);

CREATE TABLE admin_sessions (
  token       TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);

-- Extended user role enum: admin, court, stronk, peasant, user.
-- Plus linked_friend_id so Stronk knows which friend record is "theirs".
--
-- SQLite can't widen a CHECK constraint, so we do the table-rebuild
-- dance: rename old, create new with the wider CHECK + new column,
-- copy rows over, drop old. FK checks have to be off during the swap
-- because other tables (sessions, polls, hall posts, passkeys, …) point
-- at users(id) and would otherwise fail.

PRAGMA foreign_keys=OFF;

CREATE TABLE users_new (
  id                     TEXT PRIMARY KEY,
  username               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash          TEXT,
  security_question      TEXT,
  security_answer_hash   TEXT,
  role                   TEXT NOT NULL DEFAULT 'user'
                         CHECK (role IN ('user', 'admin', 'court', 'stronk', 'peasant')),
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  avatar_data            BLOB,
  avatar_mime            TEXT,
  avatar_updated_at      TEXT,
  linked_friend_id       TEXT
);

INSERT INTO users_new (
  id, username, password_hash, security_question, security_answer_hash,
  role, created_at, updated_at, avatar_data, avatar_mime, avatar_updated_at
)
SELECT
  id, username, password_hash, security_question, security_answer_hash,
  role, created_at, updated_at, avatar_data, avatar_mime, avatar_updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX idx_users_linked_friend ON users(linked_friend_id);

PRAGMA foreign_keys=ON;

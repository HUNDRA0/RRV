-- User accounts + polls.
-- Users register with username + password + a security question/answer pair.
-- The answer is the recovery mechanism (Phase 1 — email/passkeys can come later).
-- Polls are created by logged-in users; one vote per user per poll.

CREATE TABLE users (
  id                     TEXT PRIMARY KEY,                     -- short random id
  username               TEXT NOT NULL UNIQUE COLLATE NOCASE,  -- case-insensitive uniqueness
  password_hash          TEXT NOT NULL,                        -- scrypt: salt:hash hex
  security_question      TEXT NOT NULL,
  security_answer_hash   TEXT NOT NULL,                        -- scrypt of lowercased+trimmed answer
  role                   TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);

CREATE TABLE polls (
  id           TEXT PRIMARY KEY,                                -- short random id
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id     TEXT,                                            -- soft ref to client-side event id; nullable
  question     TEXT NOT NULL,
  closes_at    TEXT,                                            -- optional auto-close timestamp
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_polls_event ON polls(event_id);
CREATE INDEX idx_polls_created ON polls(created_at);

CREATE TABLE poll_options (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id   TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,
  position  INTEGER NOT NULL,
  UNIQUE (poll_id, position)
);
CREATE INDEX idx_poll_options_poll ON poll_options(poll_id);

CREATE TABLE poll_votes (
  poll_id    TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id  INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (poll_id, user_id)
);
CREATE INDEX idx_poll_votes_option ON poll_votes(option_id);

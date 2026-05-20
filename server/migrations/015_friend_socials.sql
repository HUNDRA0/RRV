-- Social media links per friend.
-- Admin (and eventually the friend themselves) fills these in via the UI.
-- We do NOT auto-discover handles — that's a privacy minefield.
--
-- platform is a lowercased identifier (instagram, facebook, linkedin, x,
-- tiktok, github, youtube, snapchat, discord, twitch, threads). The client
-- knows how to render an icon + build a mobile deep link for each.
-- handle is what the user typed (e.g. "jacob.s" or a full URL).

CREATE TABLE friend_socials (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id   TEXT NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,
  handle      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (friend_id, platform)
);
CREATE INDEX idx_friend_socials_friend ON friend_socials(friend_id);

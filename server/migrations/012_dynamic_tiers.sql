-- Remove CHECK (tier IN ('s','a','i')) so any tier ID can be used
PRAGMA foreign_keys=OFF;
CREATE TABLE friends_new (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  rank          INTEGER NOT NULL,
  tier          TEXT NOT NULL DEFAULT 'i',
  street        TEXT NOT NULL DEFAULT '',
  postcode      TEXT NOT NULL DEFAULT '',
  city          TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  current_move  TEXT NOT NULL DEFAULT 'To be continued',
  lat           REAL,
  lon           REAL,
  area          TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO friends_new SELECT id,name,rank,tier,street,postcode,city,note,bio,current_move,lat,lon,area,updated_at FROM friends;
DROP TABLE friends;
ALTER TABLE friends_new RENAME TO friends;
PRAGMA foreign_keys=ON;

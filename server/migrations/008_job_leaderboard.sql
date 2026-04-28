-- Job Leaderboard: admin-reorderable ranking of who has the best job.
-- Seeded in current rank order (1–16) from the friends table.

CREATE TABLE job_leaderboard (
  position   INTEGER PRIMARY KEY,  -- 1..N
  friend_id  TEXT NOT NULL UNIQUE REFERENCES friends(id)
);

INSERT INTO job_leaderboard (position, friend_id)
SELECT rank, id FROM friends ORDER BY rank;

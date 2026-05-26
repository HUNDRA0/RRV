-- Comments + reactions (like / dislike) on Hall of Fame posts.
-- One reaction per (post, user) — set kind to 'like' or 'dislike',
-- or delete the row to clear it. Comments cascade with the post.

CREATE TABLE hall_of_fame_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES hall_of_fame_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_hall_comments_post ON hall_of_fame_comments(post_id, created_at);

CREATE TABLE hall_of_fame_reactions (
  post_id TEXT NOT NULL REFERENCES hall_of_fame_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('like', 'dislike')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX idx_hall_reactions_post ON hall_of_fame_reactions(post_id, kind);

-- View counter on Hall of Fame posts. Increments once per session per
-- post (deduped client-side via sessionStorage). Used for the
-- "most viewed" sort and the 👁 chip next to like / dislike / share.

ALTER TABLE hall_of_fame_posts ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;

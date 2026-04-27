-- Per-person bio paragraph (the funny "why are they at this rank" blurb).
-- Empty string default so existing rows don't violate NOT NULL.

ALTER TABLE friends ADD COLUMN bio TEXT NOT NULL DEFAULT '';

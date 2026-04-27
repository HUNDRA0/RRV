-- Adds current_move column for the "Making Moves 2026" board.
-- Default is empty — admin fills in via the UI.

ALTER TABLE friends ADD COLUMN current_move TEXT NOT NULL DEFAULT '';

-- Seed the two known moves.
UPDATE friends SET current_move = 'Förlovad' WHERE id = 'jacob';
UPDATE friends SET current_move = 'Gått på kaffe' WHERE id = 'joseph';

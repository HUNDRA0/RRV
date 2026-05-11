CREATE TABLE IF NOT EXISTS catan_games (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,  -- JSON blob of full GameState
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS catan_players (
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  PRIMARY KEY (game_id, player_id)
);

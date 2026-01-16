CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_watchlist (
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  external_game_id TEXT NOT NULL,
  cc TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, store_id, external_game_id, cc)
);

CREATE INDEX IF NOT EXISTS idx_watch_store_game
  ON user_watchlist(store_id, external_game_id, cc);

CREATE INDEX IF NOT EXISTS idx_watch_user
  ON user_watchlist(user_id);

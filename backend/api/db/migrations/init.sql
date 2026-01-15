CREATE TABLE IF NOT EXISTS games (
  store_id TEXT NOT NULL,
  external_game_id TEXT NOT NULL,        -- Steam appid as string
  name TEXT NOT NULL,
  type TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (store_id, external_game_id)
);

CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);

-- Price rows (Germany only for now, cc="de")
CREATE TABLE IF NOT EXISTS prices (
  store_id TEXT NOT NULL,
  external_game_id TEXT NOT NULL,
  cc TEXT NOT NULL,                      -- "de"
  currency TEXT,                         -- "EUR"

  current_initial_cents INTEGER,
  current_final_cents INTEGER,
  current_discount_percent INTEGER,
  fetched_at INTEGER NOT NULL,

  lowest_final_cents INTEGER,
  lowest_at INTEGER,

  PRIMARY KEY (store_id, external_game_id, cc),
  FOREIGN KEY (store_id, external_game_id) REFERENCES games(store_id, external_game_id)
);

CREATE INDEX IF NOT EXISTS idx_prices_fetched ON prices(fetched_at);

-- Games to refresh in the daily updater.
CREATE TABLE IF NOT EXISTS tracked_games (
  store_id TEXT NOT NULL,
  external_game_id TEXT NOT NULL,
  cc TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (store_id, external_game_id, cc)
);

CREATE INDEX IF NOT EXISTS idx_tracked_added ON tracked_games(added_at);

CREATE TABLE IF NOT EXISTS user_watchlist (
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  external_game_id TEXT NOT NULL,
  cc TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, store_id, external_game_id, cc)
);

CREATE INDEX IF NOT EXISTS idx_watch_store_game ON user_watchlist(store_id, external_game_id, cc);

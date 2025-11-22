CREATE TABLE users if not exists (
    id              BIGSERIAL PRIMARY KEY,
    email           TEXT UNIQUE,          -- nullable if user only has Steam login
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT,                 -- nullable if external-only
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_provider_accounts if not exists (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider           TEXT NOT NULL,               -- 'steam', 'battlenet', 'epic', ...
    provider_user_id   TEXT NOT NULL,               -- SteamID, Battle.net ID, etc.
    display_name       TEXT,
    avatar_url         TEXT,
    access_token_enc   BYTEA,                       -- encrypted
    refresh_token_enc  BYTEA,                       -- encrypted
    expires_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)
);


-- Games table: catalog of tracked games. Keep a small set of searchable fields
-- and record the last known price on the game row to avoid storing unchanged
-- values in the history table. Application logic should only write a new
-- `game_price_history` row when the observed price differs from
-- `games.last_price_cents` to minimise storage.
CREATE TABLE IF NOT EXISTS games (
    id                 BIGSERIAL PRIMARY KEY,
    external_id        TEXT UNIQUE NOT NULL,    -- identifier from provider/store
    name               TEXT NOT NULL,
    last_price_cents   BIGINT,                  -- last observed price in cents
    currency           TEXT,                    -- ISO currency code (e.g. EUR, USD)
    last_checked_at    TIMESTAMPTZ,             -- when last price was checked
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Price history: only insert when price changes (app-level check recommended).
CREATE TABLE IF NOT EXISTS game_price_history (
    id                 BIGSERIAL PRIMARY KEY,
    game_id            BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    price_cents        BIGINT NOT NULL,
    currency           TEXT NOT NULL,
    recorded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_price_history_game_id_recorded_at
    ON game_price_history (game_id, recorded_at DESC);

-- Wishlist: links users to tracked games + optional target price for alerts
CREATE TABLE IF NOT EXISTS user_wishlist (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id            BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    target_price_cents BIGINT, -- optional: user wants notification at or below this price
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_games_external_id ON games (external_id);
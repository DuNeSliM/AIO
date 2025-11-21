-- Users and Authentication
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    email           TEXT UNIQUE,          -- nullable if user only has external login
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT,                 -- nullable if external-only
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_store_accounts (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store              TEXT NOT NULL,               -- 'steam', 'epic', 'gog', 'xbox', 'battlenet', 'uplay', 'amazon', 'ea', 'psn'
    store_user_id      TEXT NOT NULL,               -- Store's user ID
    display_name       TEXT,
    avatar_url         TEXT,
    access_token_enc   BYTEA,                       -- encrypted OAuth token
    refresh_token_enc  BYTEA,                       -- encrypted refresh token
    expires_at         TIMESTAMPTZ,
    is_connected       BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at     TIMESTAMPTZ,
    auto_import        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, store),
    UNIQUE (store, store_user_id)
);

-- Games Database
CREATE TABLE IF NOT EXISTS games (
    id                BIGSERIAL PRIMARY KEY,
    name              TEXT NOT NULL,
    description       TEXT,
    release_date      DATE,
    developer         TEXT,
    publisher         TEXT,
    cover_image       TEXT,
    background_image  TEXT,
    icon              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
CREATE INDEX IF NOT EXISTS idx_games_release_date ON games(release_date);

CREATE TABLE IF NOT EXISTS game_genres (
    game_id    BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    genre      TEXT NOT NULL,
    PRIMARY KEY (game_id, genre)
);

CREATE INDEX IF NOT EXISTS idx_game_genres_genre ON game_genres(genre);

CREATE TABLE IF NOT EXISTS game_tags (
    game_id    BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    tag        TEXT NOT NULL,
    PRIMARY KEY (game_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_game_tags_tag ON game_tags(tag);

CREATE TABLE IF NOT EXISTS game_platforms (
    game_id    BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    platform   TEXT NOT NULL,
    PRIMARY KEY (game_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_game_platforms_platform ON game_platforms(platform);

CREATE TABLE IF NOT EXISTS game_metadata (
    game_id           BIGINT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    metacritic_score  INTEGER,
    user_rating       DECIMAL(3,2),      -- 0.00 to 5.00
    rating_count      INTEGER NOT NULL DEFAULT 0,
    play_time         INTEGER NOT NULL DEFAULT 0,  -- average playtime in minutes
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store Information
CREATE TABLE IF NOT EXISTS store_games (
    id              BIGSERIAL PRIMARY KEY,
    game_id         BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    store           TEXT NOT NULL,         -- steam, epic, gog, xbox, battlenet, uplay, amazon, ea, psn
    store_game_id   TEXT NOT NULL,         -- Store's internal game ID
    store_url       TEXT NOT NULL,
    price           DECIMAL(10,2),
    discount_price  DECIMAL(10,2),
    currency        TEXT NOT NULL DEFAULT 'USD',
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    last_checked    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store, store_game_id)
);

CREATE INDEX IF NOT EXISTS idx_store_games_game_id ON store_games(game_id);
CREATE INDEX IF NOT EXISTS idx_store_games_store ON store_games(store);
CREATE INDEX IF NOT EXISTS idx_store_games_price ON store_games(price);

-- User Library
CREATE TABLE IF NOT EXISTS user_library (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id             BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    store               TEXT NOT NULL,
    store_game_id       TEXT NOT NULL,
    play_time           INTEGER NOT NULL DEFAULT 0,  -- in minutes
    last_played         TIMESTAMPTZ,
    install_path        TEXT,
    is_installed        BOOLEAN NOT NULL DEFAULT FALSE,
    is_favorite         BOOLEAN NOT NULL DEFAULT FALSE,
    is_hidden           BOOLEAN NOT NULL DEFAULT FALSE,
    completion_status   TEXT NOT NULL DEFAULT 'not_played', -- not_played, playing, completed, abandoned, on_hold, platinumed
    user_rating         INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_notes          TEXT,
    added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, store, store_game_id)
);

CREATE INDEX IF NOT EXISTS idx_user_library_user_id ON user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_game_id ON user_library(game_id);
CREATE INDEX IF NOT EXISTS idx_user_library_store ON user_library(store);
CREATE INDEX IF NOT EXISTS idx_user_library_is_favorite ON user_library(is_favorite);
CREATE INDEX IF NOT EXISTS idx_user_library_completion ON user_library(completion_status);

-- Wishlist
CREATE TABLE IF NOT EXISTS wishlist (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id             BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    priority            INTEGER NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    notes               TEXT,
    notify_on_discount  BOOLEAN NOT NULL DEFAULT TRUE,
    max_price           DECIMAL(10,2),
    added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_game_id ON wishlist(game_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_priority ON wishlist(priority);

-- Price History (for tracking deals and price changes)
CREATE TABLE IF NOT EXISTS price_history (
    id              BIGSERIAL PRIMARY KEY,
    store_game_id   BIGINT NOT NULL REFERENCES store_games(id) ON DELETE CASCADE,
    price           DECIMAL(10,2) NOT NULL,
    discount_price  DECIMAL(10,2),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_store_game ON price_history(store_game_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded ON price_history(recorded_at);

-- User Collections (custom game collections)
CREATE TABLE IF NOT EXISTS collections (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    is_public   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);

CREATE TABLE IF NOT EXISTS collection_games (
    collection_id   BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    game_id         BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, game_id)
);

-- Achievements (if we want to track them)
CREATE TABLE IF NOT EXISTS game_achievements (
    id              BIGSERIAL PRIMARY KEY,
    game_id         BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    store           TEXT NOT NULL,
    achievement_id  TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    icon            TEXT,
    UNIQUE (game_id, store, achievement_id)
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id  BIGINT NOT NULL REFERENCES game_achievements(id) ON DELETE CASCADE,
    unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);


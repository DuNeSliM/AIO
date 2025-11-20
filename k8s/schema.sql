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


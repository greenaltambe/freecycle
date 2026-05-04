-- =====================================================================
-- Local Free Stuff Platform - Database Schema
-- PostgreSQL 15 + PostGIS 3.x
-- This file is auto-loaded by the official postgis Docker image on first
-- run via /docker-entrypoint-initdb.d.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS postgis;      -- geography/geometry types

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(120),
    avatar_url      TEXT,
    -- Default user location (geography point: lon lat, SRID 4326)
    location        GEOGRAPHY(POINT, 4326),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST (location);

-- ---------------------------------------------------------------------
-- CATEGORIES (small lookup table)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id    SERIAL PRIMARY KEY,
    slug  VARCHAR(50) NOT NULL UNIQUE,
    name  VARCHAR(80) NOT NULL
);

INSERT INTO categories (slug, name) VALUES
    ('furniture',   'Furniture'),
    ('electronics', 'Electronics'),
    ('clothing',    'Clothing'),
    ('books',       'Books'),
    ('toys',        'Toys & Games'),
    ('kitchen',     'Kitchen'),
    ('garden',      'Garden & Outdoor'),
    ('other',       'Other')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- LISTINGS
-- ---------------------------------------------------------------------
CREATE TYPE listing_status AS ENUM ('available', 'taken', 'removed');

CREATE TABLE IF NOT EXISTS listings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id   INT  REFERENCES categories(id),
    title         VARCHAR(140) NOT NULL,
    description   TEXT,
    status        listing_status NOT NULL DEFAULT 'available',
    location      GEOGRAPHY(POINT, 4326) NOT NULL,
    address_text  VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_location  ON listings USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_listings_user      ON listings (user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status    ON listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_category  ON listings (category_id);
CREATE INDEX IF NOT EXISTS idx_listings_created   ON listings (created_at DESC);

-- ---------------------------------------------------------------------
-- IMAGES (1 listing -> N images, hosted on S3)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    s3_key      TEXT NOT NULL,
    position    SMALLINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_listing ON images (listing_id);

-- ---------------------------------------------------------------------
-- CHATS (1:1, deduplicated by sorted user pair)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chats (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id   UUID REFERENCES listings(id) ON DELETE SET NULL,
    user_a_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Always store the smaller UUID as user_a_id so the pair is unique
    CONSTRAINT chk_user_pair_order  CHECK (user_a_id < user_b_id),
    CONSTRAINT uq_chat_pair_listing UNIQUE (user_a_id, user_b_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_chats_user_a ON chats (user_a_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_b ON chats (user_b_id);

-- ---------------------------------------------------------------------
-- MESSAGES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages (sender_id);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TYPE notification_type AS ENUM (
    'new_message',
    'new_nearby_listing',
    'listing_taken'
);

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notification_type NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications (user_id) WHERE read_at IS NULL;

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_listings_updated_at ON listings;
CREATE TRIGGER trg_listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

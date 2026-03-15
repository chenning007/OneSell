-- =============================================================================
-- OneSell Scout — PostgreSQL 16 Schema
-- Version   : 1.0.0
-- Date      : 2026-03-15
-- Author    : Architect
-- Issue     : #5
-- Depends on: ADR-001 (#3), api-contract.md (#4)
-- =============================================================================
--
-- DATA RETENTION RULES
-- ---------------------
-- Raw extracted marketplace data (in redis, not postgres): purged after 1 hour via TTL.
-- analysis_sessions.payload and .raw_results columns: purged by a scheduled job
--   after 24 hours from session completion to minimize sensitive data exposure.
-- analysis_sessions row itself: retained 2 years (for user history).
-- saved_products: retained until user deletes them.
-- users / user_preferences: retained until account deletion.
-- All deletions are hard deletes; no soft-delete model in v1.
--
-- EXTENSIONS
-- ----------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy keyword search on saved products

-- =============================================================================
-- TABLE: users
-- =============================================================================
-- One row per registered OneSell Scout user account.
-- Credentials (hashed passwords) are managed by the Auth service and stored
-- in a separate auth schema (not defined here). This table holds profile data.
-- =============================================================================

CREATE TABLE users (
    id              TEXT        PRIMARY KEY,          -- ULID, e.g. '01HXXXXXXXXXXXXXXXXXXXX'
    email           TEXT        NOT NULL UNIQUE,
    display_name    TEXT,
    plan            TEXT        NOT NULL DEFAULT 'free'
                                CHECK (plan IN ('free', 'pro')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: auth look-up by email
CREATE INDEX idx_users_email ON users (email);


-- =============================================================================
-- TABLE: user_preferences
-- =============================================================================
-- One-to-one extension of users.  Stores market and UX preferences set during
-- onboarding or the Settings screen.  Separated to allow lazy creation — new
-- users have no preferences row until they complete the onboarding wizard.
-- =============================================================================

CREATE TABLE user_preferences (
    user_id                     TEXT        PRIMARY KEY
                                            REFERENCES users (id) ON DELETE CASCADE,
    default_market              TEXT        CHECK (default_market IN ('us','cn','sea','uk','de','jp','au')),
    default_currency            TEXT,       -- ISO 4217
    default_budget_amount       NUMERIC(12,2),
    default_budget_currency     TEXT,       -- ISO 4217
    experience_level            TEXT        CHECK (experience_level IN ('none','some','experienced')),
    risk_tolerance              TEXT        CHECK (risk_tolerance IN ('low','medium','high')),
    fulfillment_preference      TEXT        CHECK (fulfillment_preference IN ('fba','fbm','dropship','any')),
    preferred_platforms         TEXT[],     -- array of platform identifiers
    ui_locale                   TEXT        NOT NULL DEFAULT 'en',
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- TABLE: analysis_sessions
-- =============================================================================
-- One row per POST /api/v1/analysis request.  Tracks async agent pipeline
-- status, stores the original payload and final results (both purged after 24h).
-- =============================================================================

CREATE TABLE analysis_sessions (
    id                  TEXT        PRIMARY KEY,          -- ULID, returned in 202 response
    user_id             TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status              TEXT        NOT NULL DEFAULT 'queued'
                                    CHECK (status IN ('queued','running','complete','failed')),
    market              TEXT        NOT NULL
                                    CHECK (market IN ('us','cn','sea','uk','de','jp','au')),
    keyword             TEXT        NOT NULL,
    schema_version      TEXT        NOT NULL,             -- semver from AnalysisPayload
    payload             JSONB,                            -- full AnalysisPayload; purged after 24h
    raw_results         JSONB,                            -- full LLM output; purged after 24h
    error_message       TEXT,                             -- set when status = 'failed'
    agent_summary       TEXT,                             -- plain-language summary from Synthesizer
    cards_count         SMALLINT,                         -- number of ProductCard results produced
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    purge_payload_after TIMESTAMPTZ GENERATED ALWAYS AS (created_at + INTERVAL '24 hours') STORED
);

-- Index: look up all sessions for a user, most recent first
CREATE INDEX idx_analysis_sessions_user_created
    ON analysis_sessions (user_id, created_at DESC);

-- Index: scheduled purge job selects sessions with payload not yet purged
CREATE INDEX idx_analysis_sessions_purge
    ON analysis_sessions (purge_payload_after)
    WHERE payload IS NOT NULL OR raw_results IS NOT NULL;


-- =============================================================================
-- TABLE: saved_products
-- =============================================================================
-- Product cards that a user explicitly saved from a completed analysis session.
-- The full card data is stored in JSONB so it remains readable even after the
-- source analysis_session payload has been purged.
-- =============================================================================

CREATE TABLE saved_products (
    id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id         TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    session_id      TEXT        REFERENCES analysis_sessions (id) ON DELETE SET NULL,
    platform        TEXT        NOT NULL,
    platform_id     TEXT        NOT NULL,    -- platform-native product/listing ID
    market          TEXT        NOT NULL
                                CHECK (market IN ('us','cn','sea','uk','de','jp','au')),
    keyword         TEXT        NOT NULL,    -- keyword used at time of analysis
    card_data       JSONB       NOT NULL,    -- full ProductCard snapshot (immutable after save)
    notes           TEXT,                   -- optional user annotation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: a user cannot save the same platform listing twice
CREATE UNIQUE INDEX idx_saved_products_unique
    ON saved_products (user_id, platform, platform_id);

-- Index: list saved products for a user, most recent first
CREATE INDEX idx_saved_products_user_created
    ON saved_products (user_id, created_at DESC);

-- Index: filter by market
CREATE INDEX idx_saved_products_user_market
    ON saved_products (user_id, market);

-- Index: filter by platform
CREATE INDEX idx_saved_products_user_platform
    ON saved_products (user_id, platform);

-- Full-text GIN index on card_data for keyword search across saved products
CREATE INDEX idx_saved_products_card_fts
    ON saved_products USING gin (card_data jsonb_path_ops);


-- =============================================================================
-- TRIGGERS: updated_at maintenance
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- REDIS TTL KEY STRUCTURE
-- =============================================================================
-- Redis is used for ephemeral state only. Nothing in Redis is source-of-truth.
-- Every key carries a TTL. No Redis key survives beyond its defined TTL.
--
-- Key schema (all keys are namespaced under "onesell:"):
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ Key pattern                              │ TTL    │ Contents            │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ onesell:session:<sessionId>:status       │ 2h     │ JSON: AnalysisStatus│
-- │ onesell:session:<sessionId>:result       │ 2h     │ JSON: AnalysisResult│
-- │ onesell:ratelimit:<userId>:analysis      │ 1h     │ counter (INCR)      │
-- │ onesell:ratelimit:<userId>:requests      │ 1min   │ counter (INCR)      │
-- │ onesell:exchange:<from>:<to>             │ 24h    │ string: rate value  │
-- │ onesell:marketconfig:<market>            │ 24h    │ JSON: MarketConfig  │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- TTL enforcement rules:
--   - Session status and result keys: set at session creation, hard 2h cap.
--     If a session surpasses 2h it is considered failed (agent timeout).
--   - Rate limit counters: use Redis INCR + EXPIRE pattern (not SET).
--   - Exchange rate cache: refreshed lazily on first miss after expiry.
--   - Market config cache: refreshed lazily on first miss after expiry.
--
-- There is NO long-lived caching in Redis. All persistent data lives in
-- PostgreSQL. Redis is purely used to avoid repeated DB reads during a
-- single short-lived analysis workflow.
--
-- Naming conventions:
--   - All keys lowercase, colon-delimited.
--   - <sessionId> = ULID of the analysis_sessions.id value.
--   - <userId>    = ULID of the users.id value.
--   - <market>    = one of: us, cn, sea, uk, de, jp, au
--   - <from>/<to> = ISO 4217 currency codes
--
-- =============================================================================

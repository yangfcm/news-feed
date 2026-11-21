-- Users and the site settings that govern sign-up. Later migrations add the content tables.
--
-- Conventions, shared by every table:
--   * Each table is STRICT, so column types are enforced. Drop the word to move to Postgres.
--   * IDs are TEXT, made by the application.
--   * Timestamps are UTC, always YYYY-MM-DDTHH:MM:SSZ, so text order is time order.
--   * Lists and rules are JSON text, parsed and validated by the application; the checks here
--     only make sure an array looks like an array and an object like an object.

-- Site-wide settings: a single row (id = 1). A change takes effect on the next request.
CREATE TABLE app_settings (
  id                         INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
  -- 1: a new user waits as pending until an admin approves them; 0: a new user is active at once.
  signup_requires_approval   INTEGER NOT NULL DEFAULT 0 CHECK (signup_requires_approval IN (0, 1)),
  -- NULL: no limit. Admins are never limited. Enforced when subscribing, not used yet.
  max_subscriptions_per_user INTEGER CHECK (max_subscriptions_per_user IS NULL OR max_subscriptions_per_user > 0),
  updated_at                 TEXT    NOT NULL CHECK (updated_at LIKE '____-__-__T__:__:__Z')
) STRICT;
INSERT INTO app_settings (id, updated_at) VALUES (1, '2026-11-21T00:00:00Z');

-- Users. A row is made the first time someone calls the API with a valid Firebase ID token
-- for a verified email: pending when signup_requires_approval is 1, else active.
CREATE TABLE users (
  id                TEXT NOT NULL PRIMARY KEY,
  auth_subject      TEXT NOT NULL UNIQUE,  -- the Firebase uid
  email             TEXT NOT NULL UNIQUE CHECK (email LIKE '%_@_%'),  -- refreshed from the token on each visit
  display_name      TEXT,
  role              TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status            TEXT NOT NULL CHECK (status IN ('pending', 'active', 'disabled')),
  time_zone         TEXT NOT NULL CHECK (time_zone <> ''),                -- IANA name, from the browser at sign-up
  country           TEXT CHECK (country IS NULL OR length(country) = 2),  -- from Cloudflare at sign-up
  default_filters   TEXT CHECK (default_filters IS NULL OR default_filters LIKE '{%}'),
  default_retention TEXT CHECK (default_retention IS NULL OR default_retention LIKE '{%}'),
  created_at        TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__Z'),
  approved_at       TEXT CHECK (approved_at IS NULL OR approved_at LIKE '____-__-__T__:__:__Z'),  -- when it became active
  last_seen_at      TEXT CHECK (last_seen_at IS NULL OR last_seen_at LIKE '____-__-__T__:__:__Z'),
  CHECK (status <> 'active' OR approved_at IS NOT NULL)
) STRICT;
CREATE INDEX users_by_status ON users (status);  -- for listing the users waiting for approval

-- ============================================================
-- REFLECTIONS PLATFORM — SUPABASE SCHEMA
-- Run this entire file in Supabase → SQL Editor → New Query
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── SCHOOLS ──────────────────────────────────────────────────
-- Links a Supabase auth user to a school name and slot number.
CREATE TABLE IF NOT EXISTS schools (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  school_name TEXT NOT NULL,
  slot_number INTEGER UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── CATEGORIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,           -- "Cat A", "Cat B", etc.
  display_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO categories (name, display_order) VALUES
  ('Cat A', 1),
  ('Cat B', 2),
  ('Cat C', 3),
  ('Cat D', 4);

-- ── EVENTS (sub-events) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id      UUID REFERENCES categories(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  rulebook_url     TEXT,                 -- Supabase Storage URL
  max_entries      INTEGER NOT NULL DEFAULT 1,   -- max entries per school
  is_team_event    BOOLEAN NOT NULL DEFAULT false,
  team_size        INTEGER,              -- max members per team entry
  event_date       DATE,
  event_time       TIME,
  venue            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── PARTICIPANTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participants (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_number      INTEGER NOT NULL,
  event_id         UUID REFERENCES events(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  entry_index      INTEGER NOT NULL DEFAULT 1,   -- 1 = first entry, 2 = second, etc.
  member_index     INTEGER NOT NULL DEFAULT 1,   -- 1 = first team member, etc.
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── MARKS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_number INTEGER NOT NULL,
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  scores      JSONB NOT NULL DEFAULT '[]',  -- array of numbers e.g. [45, 38, 20]
  total       NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slot_number, event_id)
);

-- ── RESULTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  first_slot  INTEGER,
  second_slot INTEGER,
  third_slot  INTEGER,
  published   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ANNOUNCEMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SETTINGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  registration_open   BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO settings (id, registration_open) VALUES (1, true)
  ON CONFLICT (id) DO NOTHING;

-- ── STORAGE BUCKET ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('rulebooks', 'rulebooks', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE schools       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings      ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role from metadata
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    ''
  );
$$ LANGUAGE SQL STABLE;

-- Helper: get current user's slot number
CREATE OR REPLACE FUNCTION public.get_user_slot()
RETURNS INTEGER AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'slot_number')::INTEGER,
    0
  );
$$ LANGUAGE SQL STABLE;

-- ── schools policies ─────────────────────────────────────────
-- Final years see all; schools see only their own row
CREATE POLICY "final_year_all_schools" ON schools
  FOR ALL USING (get_user_role() = 'final_year');

CREATE POLICY "school_own_row" ON schools
  FOR SELECT USING (
    get_user_role() = 'school'
    AND slot_number = get_user_slot()
  );

-- ── categories: everyone reads ────────────────────────────────
CREATE POLICY "read_categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "admin_categories" ON categories
  FOR ALL USING (get_user_role() = 'final_year');

-- ── events: everyone reads ────────────────────────────────────
CREATE POLICY "read_events" ON events
  FOR SELECT USING (true);

CREATE POLICY "admin_events" ON events
  FOR ALL USING (get_user_role() = 'final_year');

-- ── participants ──────────────────────────────────────────────
-- Schools: only manage their own slot
CREATE POLICY "school_own_participants" ON participants
  FOR ALL USING (
    get_user_role() = 'school'
    AND slot_number = get_user_slot()
  );

-- Club members: full control (read, edit names, delete, add on-spot entries)
CREATE POLICY "club_manage_participants" ON participants
  FOR ALL USING (get_user_role() = 'club_member');

-- Final years: full control
CREATE POLICY "admin_participants" ON participants
  FOR ALL USING (get_user_role() = 'final_year');

-- ── marks: final year only ────────────────────────────────────
CREATE POLICY "admin_marks" ON marks
  FOR ALL USING (get_user_role() = 'final_year');

-- ── results ──────────────────────────────────────────────────
-- Published results: everyone reads
CREATE POLICY "read_published_results" ON results
  FOR SELECT USING (published = true OR get_user_role() = 'final_year');

CREATE POLICY "admin_results" ON results
  FOR ALL USING (get_user_role() = 'final_year');

-- ── announcements: everyone reads; admin writes ───────────────
CREATE POLICY "read_announcements" ON announcements
  FOR SELECT USING (true);

CREATE POLICY "admin_announcements" ON announcements
  FOR ALL USING (get_user_role() = 'final_year');

-- ── settings: everyone reads; admin writes ───────────────────
CREATE POLICY "read_settings" ON settings
  FOR SELECT USING (true);

CREATE POLICY "admin_settings" ON settings
  FOR ALL USING (get_user_role() = 'final_year');

-- ============================================================
-- STORAGE POLICIES (rulebooks bucket)
-- ============================================================
CREATE POLICY "public_read_rulebooks" ON storage.objects
  FOR SELECT USING (bucket_id = 'rulebooks');

CREATE POLICY "admin_upload_rulebooks" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'rulebooks'
    AND get_user_role() = 'final_year'
  );

CREATE POLICY "admin_delete_rulebooks" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'rulebooks'
    AND get_user_role() = 'final_year'
  );

-- ============================================================
-- CURRENT DATA MODEL — added after the base schema above.
-- These bring the DB in line with the app as it stands today.
-- Safe to run on an existing database (all idempotent).
-- ============================================================

-- ── EVENTS: judging criteria + rules ─────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS criteria_count  INTEGER NOT NULL DEFAULT 4;
ALTER TABLE events ADD COLUMN IF NOT EXISTS criteria_names  JSONB;          -- ["Content","Delivery",...]
ALTER TABLE events ADD COLUMN IF NOT EXISTS rules           TEXT;          -- shown to schools + judges
ALTER TABLE events ADD COLUMN IF NOT EXISTS assigned_members JSONB;        -- club members assigned to the event

-- ── MARKS: per-entry scoring + finalize flag ─────────────────
ALTER TABLE marks ADD COLUMN IF NOT EXISTS entry_index INTEGER NOT NULL DEFAULT 1;
ALTER TABLE marks ADD COLUMN IF NOT EXISTS finalized   BOOLEAN NOT NULL DEFAULT false;
-- marks are unique per (slot, event, entry) now, not just (slot, event)
ALTER TABLE marks DROP CONSTRAINT IF EXISTS marks_slot_number_event_id_key;
ALTER TABLE marks ADD  CONSTRAINT marks_slot_event_entry_key UNIQUE (slot_number, event_id, entry_index);

-- ── RESULTS: full tie-aware winner groups ────────────────────
ALTER TABLE results ADD COLUMN IF NOT EXISTS winners_json TEXT;            -- JSON array of {rank,total,entries[]}

-- ── SETTINGS: configurable place points ──────────────────────
ALTER TABLE settings ADD COLUMN IF NOT EXISTS points_1st INTEGER NOT NULL DEFAULT 15;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS points_2nd INTEGER NOT NULL DEFAULT 10;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS points_3rd INTEGER NOT NULL DEFAULT 5;

-- ── SETTINGS: unlock password + security answers ─────────────
-- Gates Unlock / Full Unlock in Guest Marks; answers reset the password.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS unlock_password   TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS security_answer_1 TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS security_answer_2 TEXT;

-- ── GUEST CREDENTIALS ────────────────────────────────────────
-- Admin-managed logins handed to guest evaluators (judges).
CREATE TABLE IF NOT EXISTS guest_credentials (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  login_id       TEXT NOT NULL UNIQUE,
  email          TEXT NOT NULL,
  password_plain TEXT NOT NULL,          -- shown to admin so they can share it
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── GUEST MARKS ──────────────────────────────────────────────
-- One judge's criteria scores for one participant entry, in one event.
-- `locked` finalizes the entry so its marks can no longer be edited.
CREATE TABLE IF NOT EXISTS guest_marks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  judge_number    INTEGER NOT NULL,
  judge_name      TEXT NOT NULL,
  slot_number     INTEGER NOT NULL,
  entry_index     INTEGER NOT NULL DEFAULT 1,
  criteria_scores JSONB NOT NULL DEFAULT '[]',
  judge_total     NUMERIC NOT NULL DEFAULT 0,
  locked          BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, judge_number, slot_number, entry_index)
);

-- ── CLUB ACCOUNTS (self-registration + approval) ─────────────
-- Club members register themselves from the sign-in page; the Super Admin
-- (final_year) approves or rejects. The auth user is created at registration;
-- `status` gates access to the club portal until approved.
CREATE TABLE IF NOT EXISTS club_accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  login_id    TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'club_member',  -- club_member | final_year
  status      TEXT NOT NULL DEFAULT 'pending',      -- pending | approved | rejected
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE club_accounts ENABLE ROW LEVEL SECURITY;
-- Anyone can create a registration request (sign-up).
CREATE POLICY "anyone_register_club" ON club_accounts
  FOR INSERT WITH CHECK (true);
-- A club member can read their own row (to see approval status);
-- the final year admin can read/manage all.
CREATE POLICY "read_own_or_admin_club" ON club_accounts
  FOR SELECT USING (
    get_user_role() = 'final_year'
    OR email = (auth.jwt() ->> 'email')
  );
CREATE POLICY "admin_manage_club" ON club_accounts
  FOR ALL USING (get_user_role() = 'final_year');

-- ── ON-SPOT REGISTRATIONS ────────────────────────────────────
-- Walk-in entries added by club members on the event day.
CREATE TABLE IF NOT EXISTS onspot_registrations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_number      INTEGER NOT NULL,
  event_id         UUID REFERENCES events(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  amount_paid      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS for the new tables ───────────────────────────────────
ALTER TABLE guest_credentials    ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_marks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE onspot_registrations ENABLE ROW LEVEL SECURITY;

-- guest_credentials: admin manages; guests can read to log in
CREATE POLICY "admin_guest_credentials" ON guest_credentials
  FOR ALL USING (get_user_role() = 'final_year');
CREATE POLICY "read_guest_credentials" ON guest_credentials
  FOR SELECT USING (true);

-- guest_marks: guests submit their own; admins manage; club/final read
CREATE POLICY "guest_insert_marks" ON guest_marks
  FOR INSERT WITH CHECK (get_user_role() = 'guest');
CREATE POLICY "guest_update_own_marks" ON guest_marks
  FOR UPDATE USING (get_user_role() = 'guest');
CREATE POLICY "read_guest_marks" ON guest_marks
  FOR SELECT USING (get_user_role() IN ('guest', 'club_member', 'final_year'));
CREATE POLICY "admin_guest_marks" ON guest_marks
  FOR ALL USING (get_user_role() = 'final_year');

-- onspot_registrations: club members + final years manage
CREATE POLICY "club_onspot" ON onspot_registrations
  FOR ALL USING (get_user_role() IN ('club_member', 'final_year'));

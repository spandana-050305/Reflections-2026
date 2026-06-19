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

-- Club members + final years: read all
CREATE POLICY "club_read_participants" ON participants
  FOR SELECT USING (
    get_user_role() IN ('club_member', 'final_year')
  );

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

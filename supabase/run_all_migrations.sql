-- Migration: add social platform credential columns to organizations
-- Run this in Supabase SQL Editor

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS linkedin_client_id       text,
  ADD COLUMN IF NOT EXISTS linkedin_client_secret   text,  -- sensitive: never returned to client
  ADD COLUMN IF NOT EXISTS linkedin_access_token    text,  -- sensitive: already exists, kept
  ADD COLUMN IF NOT EXISTS linkedin_company_id      text,
  ADD COLUMN IF NOT EXISTS linkedin_company_url     text,
  ADD COLUMN IF NOT EXISTS instagram_app_id         text,
  ADD COLUMN IF NOT EXISTS instagram_app_secret     text,  -- sensitive: never returned to client
  ADD COLUMN IF NOT EXISTS instagram_access_token   text,  -- sensitive: already exists, kept
  ADD COLUMN IF NOT EXISTS instagram_business_account_id text,
  ADD COLUMN IF NOT EXISTS instagram_handles        text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at               timestamptz DEFAULT now();

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION update_org_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_org_updated_at();

-- Org owners can update their org (settings save)
DO $do$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations' AND policyname = 'Org owners can update their org'
  ) THEN
    EXECUTE $$CREATE POLICY "Org owners can update their org" ON public.organizations FOR UPDATE TO authenticated USING (is_org_owner(id));$$;
  END IF;
END $do$;
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 002 — V1 helper functions + org access policies
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Canonical point map ──────────────────────────────────────────────────────
-- Every sync job, trigger, and server action calls this.
-- Change point values here once; nowhere else.
CREATE OR REPLACE FUNCTION points_for_event(p_type text)
  RETURNS integer
  LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT CASE p_type
    WHEN 'like'    THEN 1
    WHEN 'comment' THEN 3
    WHEN 'share'   THEN 5
    WHEN 'repost'  THEN 5
    WHEN 'mention' THEN 2
    ELSE 0
  END;
$$;

-- ── Org membership check (replace existing with explicit stable marking) ─────
CREATE OR REPLACE FUNCTION is_org_member(p_org_id uuid)
  RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE  org_id  = p_org_id
      AND  user_id = auth.uid()
  );
$$;

-- ── organizations SELECT policy (was missing — caused Settings to always load empty) ──
DO $do$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations' AND policyname = 'members_select_own_org'
  ) THEN
    EXECUTE $$
      CREATE POLICY members_select_own_org
        ON public.organizations FOR SELECT TO authenticated
        USING (is_org_member(id));
    $$;
  END IF;
END $do$;

-- ── organizations INSERT policy (required for ensureOrg on first login) ──────
DO $do$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations' AND policyname = 'authenticated_can_create_org'
  ) THEN
    EXECUTE $$
      CREATE POLICY authenticated_can_create_org
        ON public.organizations FOR INSERT TO authenticated
        WITH CHECK (true);
    $$;
  END IF;
END $do$;

-- ── Drop dev bypass policy on employees ─────────────────────────────────────
-- This let any auth'd user manage employees where org_id = their user UUID.
-- Safe to drop now that ensureOrg() always creates a real org via org_members.
DROP POLICY IF EXISTS "Dev: authed user can manage employees using uid as org_id"
  ON public.employees;
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 003 — Employee management
-- departments + employees (altered) + advocacy_scores + seeding triggers
-- ═══════════════════════════════════════════════════════════════════════════

-- ── departments ──────────────────────────────────────────────────────────────
-- Org-specific department list. Was hardcoded on the frontend (DEPARTMENTS
-- constant). Now stored in the DB so orgs can add custom departments.
-- employees.department_id is a FK to this table.

CREATE TABLE IF NOT EXISTS public.departments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  color      text        NOT NULL DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT departments_org_name_unique UNIQUE (org_id, name)
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY departments_org_access
  ON public.departments TO authenticated
  USING     (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE INDEX IF NOT EXISTS idx_departments_org ON public.departments (org_id);

-- Seed default departments whenever a new org is created.
CREATE OR REPLACE FUNCTION seed_default_departments()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.departments (org_id, name, color) VALUES
    (NEW.id, 'Marketing',   '#10b981'),
    (NEW.id, 'Sales',       '#3b82f6'),
    (NEW.id, 'Engineering', '#8b5cf6'),
    (NEW.id, 'Operations',  '#f59e0b'),
    (NEW.id, 'Design',      '#ec4899'),
    (NEW.id, 'HR',          '#6366f1'),
    (NEW.id, 'Finance',     '#14b8a6')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orgs_seed_departments ON public.organizations;
CREATE TRIGGER orgs_seed_departments
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION seed_default_departments();

-- Backfill default departments for any org that already exists.
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM public.organizations LOOP
    INSERT INTO public.departments (org_id, name, color) VALUES
      (r.id, 'Marketing',   '#10b981'),
      (r.id, 'Sales',       '#3b82f6'),
      (r.id, 'Engineering', '#8b5cf6'),
      (r.id, 'Operations',  '#f59e0b'),
      (r.id, 'Design',      '#ec4899'),
      (r.id, 'HR',          '#6366f1'),
      (r.id, 'Finance',     '#14b8a6')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ── employees (alter existing table) ────────────────────────────────────────
-- Add instagram_handle — required for matching API responses to employees.
-- Without this column, Instagram engagement matching is impossible.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS instagram_handle  text,
  ADD COLUMN IF NOT EXISTS department_id     uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Backfill department_id for existing employees where department text matches.
UPDATE public.employees e
SET department_id = d.id
FROM public.departments d
WHERE d.org_id = e.org_id
  AND d.name   = e.department
  AND e.department_id IS NULL;

-- Index for fast leaderboard + participation queries.
CREATE INDEX IF NOT EXISTS idx_employees_org_active
  ON public.employees (org_id, is_active);

-- ── advocacy_scores ──────────────────────────────────────────────────────────
-- One row per employee. Maintained by triggers on engagement_events.
-- Separates score data from identity data; lets the leaderboard query
-- a single compact table without joining engagement_events.
--
-- The `level` column is a generated expression — it recomputes automatically
-- whenever total_points changes. No application code needed.

CREATE TABLE IF NOT EXISTS public.advocacy_scores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL REFERENCES public.employees(id)     ON DELETE CASCADE,

  total_points   integer NOT NULL DEFAULT 0,
  likes_count    integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  shares_count   integer NOT NULL DEFAULT 0,
  reposts_count  integer NOT NULL DEFAULT 0,
  mentions_count integer NOT NULL DEFAULT 0,

  level text GENERATED ALWAYS AS (
    CASE
      WHEN total_points >= 1000 THEN 'Platinum'
      WHEN total_points >=  500 THEN 'Gold'
      WHEN total_points >=  100 THEN 'Silver'
      ELSE                           'Bronze'
    END
  ) STORED,

  last_activity_at timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT advocacy_scores_employee_unique UNIQUE (employee_id)
);

ALTER TABLE public.advocacy_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY advocacy_scores_org_access
  ON public.advocacy_scores TO authenticated
  USING     (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- Leaderboard primary index: order by score within an org.
CREATE INDEX IF NOT EXISTS idx_advocacy_scores_leaderboard
  ON public.advocacy_scores (org_id, total_points DESC);

-- Seed a zero-score row whenever a new employee is created.
-- This guarantees every employee always has an advocacy_scores row —
-- no NULL checks or LEFT JOINs needed in leaderboard queries.
CREATE OR REPLACE FUNCTION seed_advocacy_score()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.advocacy_scores (org_id, employee_id)
  VALUES (NEW.org_id, NEW.id)
  ON CONFLICT (employee_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_seed_score ON public.employees;
CREATE TRIGGER employees_seed_score
  AFTER INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION seed_advocacy_score();

-- Backfill advocacy_scores rows for employees that already exist.
INSERT INTO public.advocacy_scores (org_id, employee_id)
SELECT org_id, id FROM public.employees
ON CONFLICT (employee_id) DO NOTHING;
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 004 — Content tracking
-- company_social_accounts + company_posts (replaces posts)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── company_social_accounts ──────────────────────────────────────────────────
-- Which official FarMart accounts we monitor on each platform.
-- Decouples "what to watch" from "how to authenticate": OAuth credentials
-- (tokens, client IDs) stay in the organizations table. This table records
-- the platform account identifiers that posts belong to.
--
-- LinkedIn: platform_account_id = organization URN (urn:li:organization:xxxxx)
-- Instagram: platform_account_id = Instagram Business Account ID

CREATE TABLE IF NOT EXISTS public.company_social_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform            text NOT NULL CHECK (platform IN ('linkedin', 'instagram')),
  platform_account_id text NOT NULL,
  handle              text,         -- company slug (LinkedIn) or @handle (Instagram)
  display_name        text,         -- human-readable label shown in the UI
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT social_accounts_org_platform_id_unique
    UNIQUE (org_id, platform, platform_account_id)
);

ALTER TABLE public.company_social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_accounts_org_access
  ON public.company_social_accounts TO authenticated
  USING     (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE INDEX IF NOT EXISTS idx_social_accounts_org
  ON public.company_social_accounts (org_id);

-- ── company_posts ────────────────────────────────────────────────────────────
-- Official FarMart posts being tracked for employee engagement.
-- V1 rule: engagement_events are only recorded for posts in this table.
-- No engagement is tracked against arbitrary public or private content.
--
-- post_url is the canonical URL (LinkedIn or Instagram). Renamed from
-- linkedin_post_url in the old schema which incorrectly stored both platforms.
--
-- total_* columns are platform-wide aggregates from the API (all interactions,
-- not just employees). These show post reach. Employee-specific counts live
-- in engagement_events joined per-employee.

CREATE TABLE IF NOT EXISTS public.company_posts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.organizations(id)          ON DELETE CASCADE,
  account_id       uuid                 REFERENCES public.company_social_accounts(id) ON DELETE SET NULL,
  platform         text        NOT NULL CHECK (platform IN ('linkedin', 'instagram')),
  post_url         text        NOT NULL,
  platform_post_id text,                -- ID returned by the API; used for sync calls
  title            text,                -- admin-supplied label for easy identification
  content_preview  text,                -- first ~200 chars pulled from API response
  published_at     timestamptz,

  -- Platform aggregate totals. Updated on every sync.
  total_likes     integer NOT NULL DEFAULT 0,
  total_comments  integer NOT NULL DEFAULT 0,
  total_shares    integer NOT NULL DEFAULT 0,
  total_reposts   integer NOT NULL DEFAULT 0,
  total_mentions  integer NOT NULL DEFAULT 0,

  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'syncing', 'synced', 'error', 'archived')),
  last_synced_at  timestamptz,
  sync_error      text,                -- populated when status = 'error'
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- One URL per org — prevents duplicate sync and duplicate engagement rows.
  CONSTRAINT company_posts_org_url_unique UNIQUE (org_id, post_url)
);

ALTER TABLE public.company_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_posts_org_access
  ON public.company_posts TO authenticated
  USING     (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE INDEX IF NOT EXISTS idx_company_posts_org_status
  ON public.company_posts (org_id, status);

CREATE INDEX IF NOT EXISTS idx_company_posts_account
  ON public.company_posts (account_id);

CREATE INDEX IF NOT EXISTS idx_company_posts_org_published
  ON public.company_posts (org_id, published_at DESC NULLS LAST);
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 005 — Engagement tracking
-- engagement_events + manual_proofs + sync_logs
-- + score maintenance functions + triggers
-- ═══════════════════════════════════════════════════════════════════════════

-- ── engagement_events ────────────────────────────────────────────────────────
-- One row per unique employee-action-post combination.
-- Created by sync jobs when API responses are processed.
--
-- employee_id is nullable: when a person engages with a company post but
-- their LinkedIn URN / Instagram handle isn't in the employees table, we still
-- store the event. This lets the admin do manual matching later without
-- re-fetching from the API.
--
-- platform_actor_id is the raw identifier from the API:
--   LinkedIn: member URN  (urn:li:member:xxxxxxxxx)
--   Instagram: username   (@handle, no @)
-- The unique constraint on (post_id, platform_actor_id, event_type) prevents
-- the same person engaging the same way on the same post twice.
--
-- points is set at insert time using points_for_event(event_type). Storing the
-- value means historical scores remain stable if point rules change later.

CREATE TABLE IF NOT EXISTS public.engagement_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL REFERENCES public.organizations(id)   ON DELETE CASCADE,
  post_id           uuid        NOT NULL REFERENCES public.company_posts(id)   ON DELETE CASCADE,
  employee_id       uuid                 REFERENCES public.employees(id)       ON DELETE SET NULL,
  platform          text        NOT NULL CHECK (platform IN ('linkedin', 'instagram')),
  event_type        text        NOT NULL
    CHECK (event_type IN ('like', 'comment', 'share', 'repost', 'mention')),
  platform_actor_id text        NOT NULL,
  points            integer     NOT NULL DEFAULT 0,
  engaged_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT engagement_events_dedup UNIQUE (post_id, platform_actor_id, event_type)
);

ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY engagement_events_org_access
  ON public.engagement_events TO authenticated
  USING     (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- Fast lookup for score recalculation (by employee) and per-post analytics.
CREATE INDEX IF NOT EXISTS idx_engagement_events_employee
  ON public.engagement_events (employee_id)
  WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_engagement_events_post
  ON public.engagement_events (post_id);

-- Period-filtered leaderboard (weekly/monthly/quarterly queries).
CREATE INDEX IF NOT EXISTS idx_engagement_events_org_date
  ON public.engagement_events (org_id, engaged_at DESC);

-- ── manual_proofs ─────────────────────────────────────────────────────────────
-- Fallback for engagements that automatic API sync cannot capture
-- (platform rate limits, API permission gaps, offline advocacy).
--
-- On approval, a trigger creates an engagement_events row and links it back
-- via engagement_event_id. The engagement_events trigger then fires and
-- updates advocacy_scores automatically.
--
-- post_id is required: the admin must specify which tracked company post
-- the employee engaged with. If the post isn't tracked yet, add it first.
-- This maintains referential integrity across all engagement data.

CREATE TABLE IF NOT EXISTS public.manual_proofs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES public.organizations(id)    ON DELETE CASCADE,
  employee_id         uuid        NOT NULL REFERENCES public.employees(id)        ON DELETE CASCADE,
  post_id             uuid        NOT NULL REFERENCES public.company_posts(id)    ON DELETE CASCADE,
  platform            text        NOT NULL CHECK (platform IN ('linkedin', 'instagram')),
  event_type          text        NOT NULL
    CHECK (event_type IN ('like', 'comment', 'share', 'repost', 'mention')),
  proof_url           text,                 -- link to screenshot or the post
  notes               text,
  status              text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  points_awarded      integer     NOT NULL DEFAULT 0,
  reviewed_by         uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes      text,
  reviewed_at         timestamptz,
  -- Set when approved — audit link to the engagement_events row created.
  engagement_event_id uuid                 REFERENCES public.engagement_events(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY manual_proofs_org_access
  ON public.manual_proofs TO authenticated
  USING     (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE INDEX IF NOT EXISTS idx_manual_proofs_org_status
  ON public.manual_proofs (org_id, status);

CREATE INDEX IF NOT EXISTS idx_manual_proofs_employee
  ON public.manual_proofs (employee_id);

-- ── sync_logs ────────────────────────────────────────────────────────────────
-- Append-only audit trail for every sync run.
-- Surfaces errors in the UI so admins know which posts have stale data.
-- events_fetched = total API responses received.
-- events_matched = subset where platform_actor_id resolved to a known employee.

CREATE TABLE IF NOT EXISTS public.sync_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.organizations(id)            ON DELETE CASCADE,
  account_id       uuid                 REFERENCES public.company_social_accounts(id)  ON DELETE SET NULL,
  post_id          uuid                 REFERENCES public.company_posts(id)            ON DELETE SET NULL,
  platform         text        NOT NULL CHECK (platform IN ('linkedin', 'instagram')),
  status           text        NOT NULL CHECK (status IN ('started', 'success', 'error', 'partial')),
  events_fetched   integer     NOT NULL DEFAULT 0,
  events_matched   integer     NOT NULL DEFAULT 0,
  error_message    text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Logs are read-only after creation: no UPDATE or DELETE by users.
CREATE POLICY sync_logs_org_select
  ON public.sync_logs FOR SELECT TO authenticated
  USING (is_org_member(org_id));

CREATE POLICY sync_logs_org_insert
  ON public.sync_logs FOR INSERT TO authenticated
  WITH CHECK (is_org_member(org_id));

-- Only allow UPDATE to mark a log as completed (status + completed_at).
CREATE POLICY sync_logs_org_complete
  ON public.sync_logs FOR UPDATE TO authenticated
  USING     (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE INDEX IF NOT EXISTS idx_sync_logs_org_recent
  ON public.sync_logs (org_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_logs_post
  ON public.sync_logs (post_id)
  WHERE post_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- Score maintenance
-- ═══════════════════════════════════════════════════════════════════════════

-- Full recount from engagement_events for one employee.
-- Called by the trigger below on every INSERT / UPDATE / DELETE.
-- Full recount rather than delta arithmetic: simpler, always correct,
-- safe across concurrent writes, tolerates out-of-order trigger firing.
CREATE OR REPLACE FUNCTION refresh_advocacy_score(p_employee_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.advocacy_scores SET
    total_points    = COALESCE((
      SELECT SUM(points)  FROM public.engagement_events WHERE employee_id = p_employee_id), 0),
    likes_count     = COALESCE((
      SELECT COUNT(*)     FROM public.engagement_events WHERE employee_id = p_employee_id AND event_type = 'like'),    0),
    comments_count  = COALESCE((
      SELECT COUNT(*)     FROM public.engagement_events WHERE employee_id = p_employee_id AND event_type = 'comment'), 0),
    shares_count    = COALESCE((
      SELECT COUNT(*)     FROM public.engagement_events WHERE employee_id = p_employee_id AND event_type = 'share'),   0),
    reposts_count   = COALESCE((
      SELECT COUNT(*)     FROM public.engagement_events WHERE employee_id = p_employee_id AND event_type = 'repost'),  0),
    mentions_count  = COALESCE((
      SELECT COUNT(*)     FROM public.engagement_events WHERE employee_id = p_employee_id AND event_type = 'mention'), 0),
    last_activity_at = (
      SELECT MAX(engaged_at) FROM public.engagement_events WHERE employee_id = p_employee_id),
    updated_at = now()
  WHERE employee_id = p_employee_id;

  -- Keep employees.total_points in sync for backwards compatibility
  -- with frontend code that still reads from the employees table directly.
  UPDATE public.employees SET
    total_points = (
      SELECT COALESCE(total_points, 0) FROM public.advocacy_scores
      WHERE employee_id = p_employee_id
    ),
    level = (
      SELECT level FROM public.advocacy_scores
      WHERE employee_id = p_employee_id
    ),
    updated_at = now()
  WHERE id = p_employee_id;
END;
$$;

-- Fires after any change to engagement_events. Recounts the affected employee(s).
CREATE OR REPLACE FUNCTION trg_sync_advocacy_score()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.employee_id IS NOT NULL THEN
      PERFORM refresh_advocacy_score(OLD.employee_id);
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE
  IF NEW.employee_id IS NOT NULL THEN
    PERFORM refresh_advocacy_score(NEW.employee_id);
  END IF;

  -- On UPDATE: if employee_id changed, recount the previous employee too.
  IF TG_OP = 'UPDATE'
     AND OLD.employee_id IS NOT NULL
     AND OLD.employee_id IS DISTINCT FROM NEW.employee_id THEN
    PERFORM refresh_advocacy_score(OLD.employee_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_advocacy_score ON public.engagement_events;
CREATE TRIGGER sync_advocacy_score
  AFTER INSERT OR UPDATE OR DELETE ON public.engagement_events
  FOR EACH ROW EXECUTE FUNCTION trg_sync_advocacy_score();

-- ── Manual proof approval trigger ─────────────────────────────────────────────
-- When a proof transitions to approved, insert an engagement_events row
-- (using 'manual:<proof_id>' as platform_actor_id to avoid duplicate conflicts
-- with organically-synced events for the same post+employee+type).
-- The ON CONFLICT DO NOTHING guard means re-approving the same proof twice
-- is a no-op — idempotent by design.
-- The engagement_events trigger fires next and updates advocacy_scores.
CREATE OR REPLACE FUNCTION trg_approve_manual_proof()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.engagement_events (
      org_id, post_id, employee_id, platform,
      event_type, platform_actor_id, points, engaged_at
    ) VALUES (
      NEW.org_id,
      NEW.post_id,
      NEW.employee_id,
      NEW.platform,
      NEW.event_type,
      'manual:' || NEW.id::text,
      NEW.points_awarded,
      COALESCE(NEW.reviewed_at, now())
    )
    ON CONFLICT (post_id, platform_actor_id, event_type) DO NOTHING
    RETURNING id INTO v_event_id;

    -- Link back so it's auditable which engagement_event this proof created.
    -- The second UPDATE re-fires this trigger, but OLD.status = 'approved'
    -- so the IF condition is false — no recursion.
    IF v_event_id IS NOT NULL THEN
      UPDATE public.manual_proofs
        SET engagement_event_id = v_event_id
        WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approve_manual_proof ON public.manual_proofs;
CREATE TRIGGER approve_manual_proof
  AFTER UPDATE ON public.manual_proofs
  FOR EACH ROW EXECUTE FUNCTION trg_approve_manual_proof();
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 006 — V1 cleanup
-- Remove tables and columns that are out of V1 scope.
-- Run this AFTER 002–005 have succeeded and any data migrations are complete.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Remove campaigns (PRD §11 — out of V1 scope) ─────────────────────────────
-- manual_submissions.campaign_id FK must be dropped before dropping campaigns.
ALTER TABLE IF EXISTS public.manual_submissions
  DROP COLUMN IF EXISTS campaign_id;

-- ── Add V1 engagement fields to manual_submissions ───────────────────────────
-- engagement_type and platform are required by the V1 submissions form.
ALTER TABLE IF EXISTS public.manual_submissions
  ADD COLUMN IF NOT EXISTS engagement_type text
    CHECK (engagement_type IN ('like', 'comment', 'share', 'repost', 'mention')),
  ADD COLUMN IF NOT EXISTS platform text
    CHECK (platform IN ('linkedin', 'instagram'));

DROP TABLE IF EXISTS public.campaign_posts CASCADE;
DROP TABLE IF EXISTS public.campaigns      CASCADE;

-- ── Remove scoring_rules (replaced by points_for_event() function) ───────────
DROP TABLE IF EXISTS public.scoring_rules CASCADE;

-- ── Remove badges (replaced by advocacy_scores.level generated column) ───────
DROP TABLE IF EXISTS public.badges CASCADE;

-- ── Remove consent and location columns (not V1 scope) ───────────────────────
ALTER TABLE IF EXISTS public.employees
  DROP COLUMN IF EXISTS consent_status,
  DROP COLUMN IF EXISTS consent_at,
  DROP COLUMN IF EXISTS location;

-- ── Remove linkedin_id from employees (replaced by linkedin_url for matching) ─
-- linkedin_id was the raw member URN stored per-employee; matching is now done
-- via platform_actor_id in engagement_events vs employees.linkedin_url.
-- Check no code reads this column before running.
-- ALTER TABLE public.employees DROP COLUMN IF EXISTS linkedin_id;
-- ^ Commented out: uncomment after verifying no frontend code reads it.
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 007 — V1 critical fixes
--
-- Fixes:
--   1. Rename engagement_events.event_type → engagement_type
--      (All frontend code uses engagement_type; event_type was a naming
--       inconsistency introduced in migration 005.)
--
--   2. Fix employees.level default: 'Newcomer' → 'Bronze'
--      (V1 level system is Bronze/Silver/Gold/Platinum. The base schema had
--       'Newcomer' as the default, which is not a recognised V1 level.)
--
--   3. Add scoring trigger on manual_submissions approval
--      (Approving a manual_submissions row must update employees.total_points
--       and level. Without this trigger, the leaderboard never reflects
--       manually-approved advocacy points.)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Create manual_submissions if missing ──────────────────────────────────
-- The schema.sql included this table but it was not applied on all instances.
-- Migration 006 tried to ALTER it; this CREATE IF NOT EXISTS makes that safe.

CREATE TABLE IF NOT EXISTS public.manual_submissions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id    uuid        NOT NULL REFERENCES public.employees(id)     ON DELETE CASCADE,
  post_url       text,
  notes          text,
  status         text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  points_awarded numeric     NOT NULL DEFAULT 1,
  reviewer_notes text,
  reviewed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_submissions ENABLE ROW LEVEL SECURITY;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_submissions' AND policyname = 'Org members can read submissions') THEN
    EXECUTE $$CREATE POLICY "Org members can read submissions" ON public.manual_submissions FOR SELECT TO authenticated USING (is_org_member(org_id));$$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_submissions' AND policyname = 'Org members can create submissions') THEN
    EXECUTE $$CREATE POLICY "Org members can create submissions" ON public.manual_submissions FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));$$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_submissions' AND policyname = 'Admins can manage submissions') THEN
    EXECUTE $$CREATE POLICY "Admins can manage submissions" ON public.manual_submissions FOR ALL TO authenticated USING (is_org_member(org_id));$$;
  END IF;
END $do$;

-- Now add V1 columns (from migration 006 — safe to re-run since IF NOT EXISTS)
ALTER TABLE public.manual_submissions
  ADD COLUMN IF NOT EXISTS engagement_type text
    CHECK (engagement_type IN ('like', 'comment', 'share', 'repost', 'mention')),
  ADD COLUMN IF NOT EXISTS platform text
    CHECK (platform IN ('linkedin', 'instagram'));

-- ── 1. Rename engagement_events.event_type → engagement_type ─────────────────

ALTER TABLE public.engagement_events
  RENAME COLUMN event_type TO engagement_type;

-- Update the indexes that referenced event_type in the WHERE clause
-- (the index names don't include the column in their definition, so no
-- rename needed — just the column rename is sufficient).

-- Re-create refresh_advocacy_score to use the new column name.
CREATE OR REPLACE FUNCTION refresh_advocacy_score(p_employee_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.advocacy_scores SET
    total_points    = COALESCE((
      SELECT SUM(points)  FROM public.engagement_events WHERE employee_id = p_employee_id), 0),
    likes_count     = COALESCE((
      SELECT COUNT(*) FROM public.engagement_events WHERE employee_id = p_employee_id AND engagement_type = 'like'),    0),
    comments_count  = COALESCE((
      SELECT COUNT(*) FROM public.engagement_events WHERE employee_id = p_employee_id AND engagement_type = 'comment'), 0),
    shares_count    = COALESCE((
      SELECT COUNT(*) FROM public.engagement_events WHERE employee_id = p_employee_id AND engagement_type = 'share'),   0),
    reposts_count   = COALESCE((
      SELECT COUNT(*) FROM public.engagement_events WHERE employee_id = p_employee_id AND engagement_type = 'repost'),  0),
    mentions_count  = COALESCE((
      SELECT COUNT(*) FROM public.engagement_events WHERE employee_id = p_employee_id AND engagement_type = 'mention'), 0),
    last_activity_at = (
      SELECT MAX(engaged_at) FROM public.engagement_events WHERE employee_id = p_employee_id),
    updated_at = now()
  WHERE employee_id = p_employee_id;

  UPDATE public.employees SET
    total_points = (
      SELECT COALESCE(total_points, 0) FROM public.advocacy_scores WHERE employee_id = p_employee_id
    ),
    level = (
      SELECT level FROM public.advocacy_scores WHERE employee_id = p_employee_id
    ),
    updated_at = now()
  WHERE id = p_employee_id;
END;
$$;

-- Re-create trg_approve_manual_proof to use the new column name.
-- (manual_proofs also has this column — rename it there too for consistency.)
ALTER TABLE IF EXISTS public.manual_proofs
  RENAME COLUMN event_type TO engagement_type;

CREATE OR REPLACE FUNCTION trg_approve_manual_proof()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.engagement_events (
      org_id, post_id, employee_id, platform,
      engagement_type, platform_actor_id, points, engaged_at
    ) VALUES (
      NEW.org_id,
      NEW.post_id,
      NEW.employee_id,
      NEW.platform,
      NEW.engagement_type,
      'manual:' || NEW.id::text,
      NEW.points_awarded,
      COALESCE(NEW.reviewed_at, now())
    )
    ON CONFLICT (post_id, platform_actor_id, engagement_type) DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NOT NULL THEN
      UPDATE public.manual_proofs
        SET engagement_event_id = v_event_id
        WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Update the dedup constraint on engagement_events (was keyed to event_type; now it
-- references engagement_type implicitly via column rename — constraint needs no rename).

-- ── 2. Fix employees.level default ───────────────────────────────────────────

ALTER TABLE public.employees
  ALTER COLUMN level SET DEFAULT 'Bronze';

-- Backfill any employees still showing a legacy level name.
UPDATE public.employees
SET level = CASE
  WHEN total_points >= 1000 THEN 'Platinum'
  WHEN total_points >= 500  THEN 'Gold'
  WHEN total_points >= 100  THEN 'Silver'
  ELSE 'Bronze'
END
WHERE level NOT IN ('Bronze', 'Silver', 'Gold', 'Platinum');

-- ── 3. Scoring trigger for manual_submissions approval ────────────────────────
-- When manual_submissions.status transitions to 'approved', update the
-- employee's total_points and level directly.
-- This is a lightweight path: full score recalculation is handled by
-- refresh_advocacy_score() on the engagement_events table. Since
-- manual_submissions doesn't create an engagement_events row (that's
-- manual_proofs' job), we update employees directly here.

CREATE OR REPLACE FUNCTION trg_approve_manual_submission()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.employees SET
      total_points = total_points + NEW.points_awarded,
      level = CASE
        WHEN (total_points + NEW.points_awarded) >= 1000 THEN 'Platinum'
        WHEN (total_points + NEW.points_awarded) >= 500  THEN 'Gold'
        WHEN (total_points + NEW.points_awarded) >= 100  THEN 'Silver'
        ELSE 'Bronze'
      END,
      updated_at = now()
    WHERE id = NEW.employee_id;

  ELSIF OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved' THEN
    -- Un-approve: subtract the points (reject after approval).
    UPDATE public.employees SET
      total_points = GREATEST(0, total_points - OLD.points_awarded),
      level = CASE
        WHEN GREATEST(0, total_points - OLD.points_awarded) >= 1000 THEN 'Platinum'
        WHEN GREATEST(0, total_points - OLD.points_awarded) >= 500  THEN 'Gold'
        WHEN GREATEST(0, total_points - OLD.points_awarded) >= 100  THEN 'Silver'
        ELSE 'Bronze'
      END,
      updated_at = now()
    WHERE id = NEW.employee_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approve_manual_submission ON public.manual_submissions;
CREATE TRIGGER approve_manual_submission
  AFTER UPDATE ON public.manual_submissions
  FOR EACH ROW EXECUTE FUNCTION trg_approve_manual_submission();

-- Also seed advocacy_scores rows for any employee missing one
-- (safe to re-run; ON CONFLICT is a no-op).
INSERT INTO public.advocacy_scores (org_id, employee_id)
SELECT org_id, id FROM public.employees
ON CONFLICT (employee_id) DO NOTHING;

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

DROP POLICY IF EXISTS departments_org_access ON public.departments;
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

DROP POLICY IF EXISTS advocacy_scores_org_access ON public.advocacy_scores;
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

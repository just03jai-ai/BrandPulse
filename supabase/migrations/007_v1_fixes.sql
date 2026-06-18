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
-- Wrapped in a guard: if already renamed (re-run), this is a no-op.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'engagement_events'
      AND column_name  = 'event_type'
  ) THEN
    ALTER TABLE public.engagement_events RENAME COLUMN event_type TO engagement_type;
  END IF;
END $do$;

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
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'manual_proofs'
      AND column_name  = 'event_type'
  ) THEN
    ALTER TABLE public.manual_proofs RENAME COLUMN event_type TO engagement_type;
  END IF;
END $do$;

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

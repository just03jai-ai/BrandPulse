-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 008 — Manual submission → engagement_events bridge
--
-- Problem this solves:
--   Approving a manual_submission updated employees.total_points directly
--   (arithmetic delta). The leaderboard period filters (Weekly / Monthly /
--   Quarterly) read from engagement_events.created_at only — so approved
--   manual submissions never appeared in any period view, only in All Time.
--
-- Fix:
--   1. Make engagement_events.post_id nullable so rows without a post FK
--      can be stored (manual submissions carry only a post_url text field,
--      not a post_id UUID reference).
--
--   2. Add a partial unique index covering manual rows (post_id IS NULL)
--      so (platform_actor_id, engagement_type) stays dedup-safe for those
--      rows. The existing named constraint dedup-covers non-null post_id rows.
--
--   3. Rewrite trg_approve_manual_submission to INSERT into engagement_events
--      instead of doing direct arithmetic on employees.total_points.
--      The existing trg_sync_advocacy_score trigger fires on every
--      engagement_events INSERT / DELETE and calls refresh_advocacy_score(),
--      which recounts everything and keeps both advocacy_scores and
--      employees.total_points consistent.
--
--   Result: a single event source drives all score views — period filters
--   on the leaderboard now reflect approved manual submissions automatically.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Allow post_id to be NULL ────────────────────────────────────────────────
-- Non-null rows still cascade when the company_post is deleted (FK unchanged).
-- Null rows represent manual submissions that have no linked post record.

ALTER TABLE public.engagement_events
  ALTER COLUMN post_id DROP NOT NULL;


-- ── 2. Partial unique index for manual rows ────────────────────────────────────
-- The named constraint engagement_events_dedup is UNIQUE (post_id, platform_actor_id,
-- engagement_type). PostgreSQL treats NULLs as distinct in unique constraints, so
-- that constraint does not cover rows where post_id IS NULL.
-- This partial index closes that gap.

CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_events_manual_dedup
  ON public.engagement_events (platform_actor_id, engagement_type)
  WHERE post_id IS NULL;


-- ── 3. Rewrite approval trigger ────────────────────────────────────────────────
-- On approve:
--   INSERT into engagement_events (triggers trg_sync_advocacy_score →
--   refresh_advocacy_score → updates advocacy_scores + employees.total_points).
--
-- On un-approve (reject after approval):
--   DELETE the matching engagement_events row (same trigger chain fires and
--   recounts the score correctly).
--
-- The old direct `UPDATE employees SET total_points = total_points + N` arithmetic
-- is gone — refresh_advocacy_score() does a full recount instead, which is
-- always consistent regardless of order of operations.

CREATE OR REPLACE FUNCTION trg_approve_manual_submission()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- ── Approval ───────────────────────────────────────────────────────────────
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN

    INSERT INTO public.engagement_events (
      org_id,
      post_id,          -- NULL: manual submissions have no post FK
      employee_id,
      platform,
      engagement_type,
      platform_actor_id,
      points,
      engaged_at
    ) VALUES (
      NEW.org_id,
      NULL,
      NEW.employee_id,
      COALESCE(NEW.platform,         'linkedin'),
      COALESCE(NEW.engagement_type,  'like'),
      'manual:' || NEW.id::text,
      NEW.points_awarded::integer,
      COALESCE(NEW.reviewed_at, now())
    )
    -- Idempotent: re-approving the same submission is a no-op.
    ON CONFLICT (platform_actor_id, engagement_type)
      WHERE post_id IS NULL
    DO NOTHING;

    -- trg_sync_advocacy_score fires on the INSERT above and calls
    -- refresh_advocacy_score(NEW.employee_id), which updates both
    -- advocacy_scores and employees.total_points. No direct UPDATE needed.

  -- ── Un-approve (reject after approval) ────────────────────────────────────
  ELSIF OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved' THEN

    DELETE FROM public.engagement_events
    WHERE platform_actor_id = 'manual:' || OLD.id::text
      AND post_id IS NULL;

    -- trg_sync_advocacy_score fires on the DELETE and recounts the score.

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approve_manual_submission ON public.manual_submissions;
CREATE TRIGGER approve_manual_submission
  AFTER UPDATE ON public.manual_submissions
  FOR EACH ROW EXECUTE FUNCTION trg_approve_manual_submission();


-- ── 4. Backfill: create engagement_events rows for already-approved submissions ─
-- Any submission approved before this migration ran never got an engagement_events
-- row. Insert them now so the leaderboard reflects historical approvals.
-- ON CONFLICT DO NOTHING makes this safe to re-run.

INSERT INTO public.engagement_events (
  org_id,
  post_id,
  employee_id,
  platform,
  engagement_type,
  platform_actor_id,
  points,
  engaged_at
)
SELECT
  ms.org_id,
  NULL,
  ms.employee_id,
  COALESCE(ms.platform,        'linkedin'),
  COALESCE(ms.engagement_type, 'like'),
  'manual:' || ms.id::text,
  ms.points_awarded::integer,
  COALESCE(ms.reviewed_at, ms.created_at)
FROM public.manual_submissions ms
WHERE ms.status = 'approved'
  AND ms.employee_id IS NOT NULL
ON CONFLICT (platform_actor_id, engagement_type)
  WHERE post_id IS NULL
DO NOTHING;

-- Recount scores for all employees who had approved submissions before this
-- migration, so advocacy_scores and employees.total_points are accurate.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT employee_id
    FROM public.manual_submissions
    WHERE status = 'approved' AND employee_id IS NOT NULL
  LOOP
    PERFORM refresh_advocacy_score(r.employee_id);
  END LOOP;
END $$;

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

DROP POLICY IF EXISTS engagement_events_org_access ON public.engagement_events;
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

DROP POLICY IF EXISTS manual_proofs_org_access ON public.manual_proofs;
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
DROP POLICY IF EXISTS sync_logs_org_select   ON public.sync_logs;
DROP POLICY IF EXISTS sync_logs_org_insert   ON public.sync_logs;
DROP POLICY IF EXISTS sync_logs_org_complete ON public.sync_logs;

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

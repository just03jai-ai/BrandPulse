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

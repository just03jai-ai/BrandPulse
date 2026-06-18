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

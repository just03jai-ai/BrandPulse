-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 010 — Add total_impressions to company_posts
--
-- The LinkedIn organizationalEntityShareStatistics API returns impressionCount
-- (total views/reach) alongside like/comment/share counts. This column stores
-- that value so the Post Tracking screen can surface reach alongside engagement.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.company_posts
  ADD COLUMN IF NOT EXISTS total_impressions integer NOT NULL DEFAULT 0;

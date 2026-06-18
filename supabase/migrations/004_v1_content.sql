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

DROP POLICY IF EXISTS social_accounts_org_access ON public.company_social_accounts;
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

DROP POLICY IF EXISTS company_posts_org_access ON public.company_posts;
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 011 — Add token_expires_at to company_social_accounts
--
-- LinkedIn OAuth tokens have a defined lifetime (typically 60 days).
-- This column stores the expiry timestamp so the UI and sync route
-- can warn when a token is about to expire.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.company_social_accounts
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz NULL;

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

-- Fix: infinite recursion in org_members RLS policy
-- Run this in Supabase SQL Editor

drop policy if exists "Org owner can manage members" on org_members;

create or replace function is_org_member(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from org_members
    where org_id = p_org_id and user_id = auth.uid()
  );
$$ language sql security definer;

create or replace function is_org_owner(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from org_members
    where org_id = p_org_id and user_id = auth.uid() and role = 'owner'
  );
$$ language sql security definer;

create policy "Org owner can manage members"
  on org_members for all
  using (is_org_owner(org_id));

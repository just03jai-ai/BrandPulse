-- BrandPulse Database Schema
-- Run this in Supabase SQL Editor to set up all tables

-- ─────────────────────────────────────────────
-- ORGANIZATIONS
-- ─────────────────────────────────────────────
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  linkedin_org_id text,
  instagram_account_id text,
  linkedin_access_token text,
  instagram_access_token text,
  created_at timestamptz default now() not null
);

alter table organizations enable row level security;

-- Each user belongs to one org via org_members
create table if not exists org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'viewer')),
  created_at timestamptz default now() not null,
  unique(org_id, user_id)
);

alter table org_members enable row level security;

-- Security-definer function avoids infinite recursion when RLS checks org_members from within org_members policies
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

create policy "Members can read their own org"
  on org_members for select
  using (auth.uid() = user_id);

create policy "Org owner can manage members"
  on org_members for all
  using (is_org_owner(org_id));

-- ─────────────────────────────────────────────
-- EMPLOYEES
-- ─────────────────────────────────────────────
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text not null,
  department text,
  title text,
  linkedin_url text,
  linkedin_id text,
  avatar_url text,
  total_points numeric not null default 0,
  level text not null default 'Newcomer',
  is_active boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(org_id, email)
);

alter table employees enable row level security;

create policy "Org members can read employees"
  on employees for select
  using (
    exists (
      select 1 from org_members m
      where m.org_id = employees.org_id
        and m.user_id = auth.uid()
    )
  );

create policy "Admins can manage employees"
  on employees for all
  using (
    exists (
      select 1 from org_members m
      where m.org_id = employees.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger employees_updated_at
  before update on employees
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- POSTS
-- ─────────────────────────────────────────────
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  linkedin_post_url text not null,
  linkedin_post_id text,
  title text,
  content_preview text,
  published_at timestamptz,
  last_synced_at timestamptz,
  total_likes integer not null default 0,
  total_comments integer not null default 0,
  total_shares integer not null default 0,
  total_reposts integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'syncing', 'synced', 'error')),
  created_at timestamptz default now() not null
);

alter table posts enable row level security;

create policy "Org members can read posts"
  on posts for select
  using (
    exists (
      select 1 from org_members m
      where m.org_id = posts.org_id
        and m.user_id = auth.uid()
    )
  );

create policy "Admins can manage posts"
  on posts for all
  using (
    exists (
      select 1 from org_members m
      where m.org_id = posts.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────
-- ENGAGEMENTS
-- ─────────────────────────────────────────────
create table if not exists engagements (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  linkedin_id text,  -- raw LinkedIn profile ID before matching
  engagement_type text not null check (engagement_type in ('like', 'comment', 'share', 'repost')),
  points numeric not null default 0,
  engaged_at timestamptz,
  created_at timestamptz default now() not null,
  unique(post_id, linkedin_id, engagement_type)
);

alter table engagements enable row level security;

create policy "Org members can read engagements via posts"
  on engagements for select
  using (
    exists (
      select 1 from posts p
      join org_members m on m.org_id = p.org_id
      where p.id = engagements.post_id
        and m.user_id = auth.uid()
    )
  );

create policy "Admins can manage engagements"
  on engagements for all
  using (
    exists (
      select 1 from posts p
      join org_members m on m.org_id = p.org_id
      where p.id = engagements.post_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────
-- BADGES
-- ─────────────────────────────────────────────
create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz default now() not null,
  unique(employee_id, badge_key)
);

alter table badges enable row level security;

create policy "Org members can read badges"
  on badges for select
  using (
    exists (
      select 1 from employees e
      join org_members m on m.org_id = e.org_id
      where e.id = badges.employee_id
        and m.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- FUNCTION: recalculate employee points + level
-- ─────────────────────────────────────────────
create or replace function recalculate_employee_score(p_employee_id uuid)
returns void as $$
declare
  v_total numeric;
  v_level text;
begin
  select coalesce(sum(points), 0)
  into v_total
  from engagements
  where employee_id = p_employee_id;

  v_level := case
    when v_total >= 1000 then 'Ambassador'
    when v_total >= 500  then 'Legend'
    when v_total >= 200  then 'Champion'
    when v_total >= 50   then 'Rising Star'
    else 'Newcomer'
  end;

  update employees
  set total_points = v_total,
      level = v_level,
      updated_at = now()
  where id = p_employee_id;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────
-- TRIGGER: update employee score when engagement added
-- ─────────────────────────────────────────────
create or replace function on_engagement_change()
returns trigger as $$
begin
  if (TG_OP = 'DELETE') then
    if old.employee_id is not null then
      perform recalculate_employee_score(old.employee_id);
    end if;
    return old;
  else
    if new.employee_id is not null then
      perform recalculate_employee_score(new.employee_id);
    end if;
    return new;
  end if;
end;
$$ language plpgsql security definer;

create trigger engagements_score_update
  after insert or update or delete on engagements
  for each row execute function on_engagement_change();

-- ─────────────────────────────────────────────
-- SIMPLIFIED DEV POLICY (for solo testing without org_members)
-- Remove these in production when multi-tenancy is enforced.
-- ─────────────────────────────────────────────
-- Allows auth'd users to write employees using their own user_id as org_id.
-- This matches the dev shortcut in employee-directory.tsx.
create policy "Dev: authed user can manage employees using uid as org_id"
  on employees for all
  using (org_id::text = auth.uid()::text)
  with check (org_id::text = auth.uid()::text);

-- ─────────────────────────────────────────────
-- EMPLOYEE CONSENT & LOCATION FIELDS
-- ─────────────────────────────────────────────
alter table employees add column if not exists location text;
alter table employees add column if not exists consent_status boolean not null default false;
alter table employees add column if not exists consent_at timestamptz;

-- ─────────────────────────────────────────────
-- CAMPAIGNS
-- ─────────────────────────────────────────────
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  hashtag text,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'archived')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table campaigns enable row level security;

create policy "Org members can read campaigns"
  on campaigns for select to authenticated
  using (is_org_member(org_id));

create policy "Admins can manage campaigns"
  on campaigns for all to authenticated
  using (
    exists (
      select 1 from org_members m
      where m.org_id = campaigns.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- CAMPAIGN ↔ POSTS JUNCTION
-- ─────────────────────────────────────────────
create table if not exists campaign_posts (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  added_at timestamptz default now() not null,
  primary key (campaign_id, post_id)
);

alter table campaign_posts enable row level security;

create policy "Org members can read campaign_posts"
  on campaign_posts for select to authenticated
  using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_posts.campaign_id
        and is_org_member(c.org_id)
    )
  );

create policy "Admins can manage campaign_posts"
  on campaign_posts for all to authenticated
  using (
    exists (
      select 1 from campaigns c
      join org_members m on m.org_id = c.org_id
      where c.id = campaign_posts.campaign_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────
-- MANUAL SUBMISSIONS (employee proof + marketing review)
-- ─────────────────────────────────────────────
create table if not exists manual_submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  post_url text,
  screenshot_url text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  points_awarded numeric not null default 15,
  reviewer_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz default now() not null
);

alter table manual_submissions enable row level security;

create policy "Org members can read submissions"
  on manual_submissions for select to authenticated
  using (is_org_member(org_id));

create policy "Org members can create submissions"
  on manual_submissions for insert to authenticated
  with check (is_org_member(org_id));

create policy "Admins can manage submissions"
  on manual_submissions for all to authenticated
  using (
    exists (
      select 1 from org_members m
      where m.org_id = manual_submissions.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────
-- SCORING RULES (per-org configurable)
-- ─────────────────────────────────────────────
create table if not exists scoring_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  action text not null,
  points numeric not null default 0,
  updated_at timestamptz default now() not null,
  unique(org_id, action)
);

alter table scoring_rules enable row level security;

create policy "Org members can read scoring rules"
  on scoring_rules for select to authenticated
  using (is_org_member(org_id));

create policy "Admins can manage scoring rules"
  on scoring_rules for all to authenticated
  using (
    exists (
      select 1 from org_members m
      where m.org_id = scoring_rules.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

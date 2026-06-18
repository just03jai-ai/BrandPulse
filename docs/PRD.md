# BrandPulse V1 — Product Requirements Document

**Product:** BrandPulse  
**Version:** V1.0  
**Date:** June 2026  
**Status:** Active development  
**Owner:** FarMart Marketing Team

---

## 1. Problem Statement

FarMart publishes content on LinkedIn and Instagram every day. The marketing team has no reliable way to know which employees engage with that content.

As a result:
- Employee advocacy is invisible. Marketing cannot identify who is participating.
- Leadership cannot measure participation rates or department-level engagement.
- There is no data to reward top advocates or motivate lagging teams.
- Content reach stays lower than it could be because employee amplification is unmanaged.

The current workaround — asking employees to self-report, or manually scanning comment sections — is slow, incomplete, and does not scale past a handful of posts per month.

**BrandPulse solves one problem:** Give the FarMart marketing team a reliable, automated view of which employees are engaging with official FarMart social content, and how much.

---

## 2. User Personas

### Persona 1 — Marketing Admin
**Who:** FarMart marketing manager running the advocacy program  
**Goal:** Know which employees are engaging, which departments are active, and prove the program is working  
**Frustration:** Spends hours per week manually checking LinkedIn for employee engagement. Has no department-level data. Cannot identify top advocates reliably.  
**Uses BrandPulse for:** Dashboard overview, employee management, post tracking, leaderboard, integrations setup

### Persona 2 — Marketing Leadership / CMO
**Who:** Head of marketing or executive reviewing program health  
**Goal:** Understand advocacy participation at a high level — are we improving?  
**Frustration:** Gets anecdotal updates. No hard numbers on participation rate or advocacy growth over time.  
**Uses BrandPulse for:** Dashboard (read-only), leaderboard, analytics

### Persona 3 — HR Manager *(secondary, V1 limited)*
**Who:** HR team member who wants to recognize top advocates  
**Goal:** Identify employees deserving recognition based on objective data  
**Frustration:** No source of truth for who is actively advocating  
**Uses BrandPulse for:** Leaderboard, employee profiles

---

## 3. MVP Scope

V1 answers five questions for the FarMart marketing team:

1. Which employees engage most with FarMart content?
2. Which departments participate most?
3. Which posts receive the strongest employee support?
4. What is the overall participation rate?
5. Who are our top advocates?

**In scope:**
- Track official FarMart company posts on LinkedIn and Instagram
- Count employee engagement actions on those posts only (likes, comments, reposts/shares, mentions)
- Assign points per action type per the scoring system below
- Display employee and department rankings on a leaderboard
- Admin dashboard showing participation rate, top advocates, and engagement totals
- Employee directory with CSV bulk import, LinkedIn profile URL, and Instagram handle
- Manual proof upload flow for when API data is unavailable or incomplete
- LinkedIn API integration (primary)
- Instagram Graph API integration (secondary)

**Supported engagement actions and point values:**

| Action | Points | LinkedIn | Instagram |
|---|---|---|---|
| Like | 1 | Via API | Via API |
| Comment | 3 | Via API | Via API |
| Repost / Share | 5 | Via API | Limited via API |
| Mention | 2 | Via API | Via API |
| Manual proof (approved) | 5 (default) | Admin-set | Admin-set |

---

## 4. Non-Goals (V1)

The following are explicitly out of scope for V1. They must not be built, tracked, or exposed in the UI.

| Out of scope | Reason |
|---|---|
| Scraping LinkedIn or Instagram | Against platform ToS; use official APIs only |
| Tracking employee personal posts or activity | Private activity is out of scope |
| Tracking engagement on non-FarMart content | V1 is company-owned content only |
| Employee-facing portal or employee login | V1 is admin-only |
| Slack or Teams notifications | Post-V1 |
| AI caption generation or content scheduling | Not an advocacy tracking tool |
| Campaign management module | Adds complexity; removed from V1 |
| Rewards or redemption system | Post-V1 |
| Sentiment analysis | Post-V1 |
| White-labelling or multi-org onboarding | FarMart-only for V1 |
| Influencer or reach amplification metrics | Out of scope |
| Manager or per-employee login views | Admin-only in V1 |

---

## 5. Data Requirements

### 5.1 Employee Data

| Field | Required | Source |
|---|---|---|
| Name | Yes | CSV import or manual |
| Email | Yes | CSV import or manual |
| Department | Yes | CSV import or manual |
| Designation / Title | Optional | CSV import or manual |
| LinkedIn Profile URL | Yes (for LinkedIn tracking) | Manual entry or CSV |
| Instagram Handle | Yes (for Instagram tracking) | Manual entry or CSV |

### 5.2 Company Post Data

| Field | Required | Source |
|---|---|---|
| Post URL | Yes | Admin-entered |
| Platform | Yes | Derived from URL (LinkedIn / Instagram) |
| LinkedIn Post ID | For LinkedIn API | Extracted from URL |
| Published date | Yes | API or admin-entered |
| Content preview / title | Optional | API or admin-entered |
| Total likes | Auto-synced | API |
| Total comments | Auto-synced | API |
| Total reposts / shares | Auto-synced | API |
| Sync status | Auto | System-managed |

### 5.3 Engagement Data

| Field | Required | Source |
|---|---|---|
| Post reference | Yes | FK to posts |
| Employee reference | Yes (after matching) | FK to employees |
| Platform profile ID (raw) | Yes | API response |
| Action type | Yes | API (like, comment, share, repost, mention) |
| Points assigned | Yes | Scoring rule lookup |
| Timestamp | Yes | API |

### 5.4 Organisation Data (Integrations)

| Field | Source | Security |
|---|---|---|
| LinkedIn Organisation ID | Admin-entered | Stored server-side |
| LinkedIn Client ID | Admin-entered | Stored server-side |
| LinkedIn Client Secret | Admin-entered | Write-only; never returned to client |
| LinkedIn Access Token | OAuth flow | Write-only; never returned to client |
| Instagram App ID | Admin-entered | Stored server-side |
| Instagram App Secret | Admin-entered | Write-only; never returned to client |
| Instagram Access Token | OAuth flow | Write-only; never returned to client |
| Instagram Business Account ID | Admin-entered | Stored server-side |

---

## 6. Screens Required

### Screen 1 — Dashboard
**Purpose:** Executive and admin overview  
**Data shown:**
- Total active employees
- Employees who engaged in current month (count + % participation)
- Total engagement actions this month
- Breakdown: likes / comments / reposts / mentions
- Top 5 advocates (name, department, score)
- Department participation chart (bar or heatmap)
- Weekly engagement trend (line chart, last 8 weeks)
- Top performing posts (title, platform, total engagements)

**State:** Empty state shown until at least one post is tracked and one engagement is synced.

---

### Screen 2 — Content (Post Tracking)
**Purpose:** Library of tracked FarMart company posts  
**Data shown:**
- List of all tracked posts with platform badge (LinkedIn / Instagram)
- Published date, engagement totals (likes, comments, reposts), sync status
- Add new post (paste URL, select platform, set publish date)
- Trigger manual sync
- Link to live post

**States:** Empty state, syncing indicator, sync error with retry action.

---

### Screen 3 — Leaderboard
**Purpose:** Employee gamification and participation visibility  
**Data shown:**
- Employee ranking by advocacy score
- Score, level badge, department tag per employee
- Department ranking tab
- Time filters: This Week / This Month / This Quarter / All Time
- Top 3 highlighted with visual treatment

**States:** Empty state until employees and engagements exist.

---

### Screen 4 — Employees
**Purpose:** Employee directory and social profile management  
**Data shown:**
- Searchable, filterable employee list (by department, status)
- Per-employee: name, department, title, LinkedIn URL, Instagram handle, total points, level, status
- Add employee (manual form)
- Edit employee
- Bulk import via CSV (drag-drop, preview with new vs. duplicate count, import)
- Employee profile side panel: per-action engagement breakdown, advocacy score, participation history

**CSV required columns:** name, email  
**CSV optional columns:** department, title, linkedin_url, instagram_handle

---

### Screen 5 — Analytics
**Purpose:** Marketing insights and participation trends  
**Data shown:**
- Engagement trend over time (line chart — weekly, last 12 weeks)
- Participation rate trend (% employees active per week)
- Department performance table (department, active employees, total engagements, avg score)
- Advocacy growth (total points accumulated over time)
- Platform breakdown (LinkedIn vs. Instagram split)

**States:** Empty state until engagement data exists.

---

### Screen 6 — Integrations (Settings)
**Purpose:** Connect LinkedIn and Instagram APIs  
**Sections:**

**LinkedIn:**
- Company URL (public, shown)
- Organisation ID (public, shown)
- Client ID (public, shown)
- Client Secret (write-only: shows "saved" indicator, Update button to replace)
- Access Token (write-only: shows "saved" indicator, Update button to replace)
- Test Connection button → live API check, shows status

**Instagram:**
- App ID (public, shown)
- Business Account ID (public, shown)
- Instagram Handles (array, shown)
- App Secret (write-only)
- Access Token (write-only)
- Test Connection button → live API check, shows status

**API status indicators:** Connected / Not connected / Error (with message)

---

### Screen 7 — Manual Submissions *(fallback when API is unavailable)*
**Purpose:** Allow admin to record employee engagement that cannot be captured via API  
**Flow:**
- Admin or employee submits: employee name, post URL, engagement type, optional screenshot URL, optional notes
- Admin reviews submission queue
- Admin approves (assigns points) or rejects (with notes)
- Approved submissions update employee score via the same scoring engine

**States:** Empty queue, pending review items, approved/rejected history.

---

## 7. Backend Requirements

### 7.1 Scoring Engine
- Points assigned at engagement insert time based on `scoring_rules` table for the org
- Default points per org: like=1, comment=3, repost=5, share=5, mention=2
- `employees.total_points` auto-updated via database trigger on every engagement change
- `employees.level` auto-updated by same trigger (Newcomer → Rising Star → Champion → Legend → Ambassador)

### 7.2 Employee ↔ Platform Matching
- LinkedIn engagements matched by `linkedin_id` (raw profile ID from API) to `employees.linkedin_id`
- Instagram engagements matched by handle to `employees.instagram_handle`
- Unmatched engagements stored with `employee_id = null` until employee record is updated
- Re-matching runs on employee profile update to capture previously unmatched engagements

### 7.3 Sync Architecture
- Sync triggered manually (admin clicks Sync) or via scheduled job (future)
- Sync writes raw engagement records to `engagements` table
- Trigger on `engagements` auto-updates employee score
- Sync status tracked on `posts.status`: pending → syncing → synced / error
- Failed syncs log error message on post record

### 7.4 Security
- All data isolated per organisation via `org_id` on every table
- Row-level security enforced at database layer for all tables
- Secret credentials (client secrets, access tokens) stored in database but never returned to client
- Client receives boolean indicators only (`has_linkedin_client_secret`, `has_instagram_access_token`)
- Org membership enforced via `org_members` join table

### 7.5 Manual Submissions
- Submissions recorded in `manual_submissions` table
- Approved submissions insert a corresponding `engagements` row, triggering score update
- Rejected submissions have no effect on scores

---

## 8. API Requirements

### 8.1 LinkedIn

**Required access:**
- LinkedIn Marketing Developer Platform or Community Management API access
- Organisation ID for FarMart company page
- OAuth 2.0 app credentials (client ID + secret)
- Scopes: `r_organization_social`, `w_organization_social` (read engagement data on company posts)

**What the API provides:**
- List of reactions (likes) on a company post by member URN
- List of comments on a company post by member URN
- List of reposts/shares by member URN
- Mention detection via comment text parsing

**What the API does NOT provide:**
- Employee private activity
- Who viewed a post
- Engagement on posts that are not owned by the authenticated organisation

**Matching approach:**
LinkedIn API returns `memberUrn` or `vanityName`. Employee records store `linkedin_id` (member URN) and `linkedin_url` (vanity URL). Matching is done server-side before writing engagement rows.

---

### 8.2 Instagram

**Required access:**
- Instagram Business Account connected to a Facebook Page
- Meta Business Manager account
- Instagram Graph API (via Meta for Developers)
- Scopes: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`

**What the API provides:**
- Comments on business account media (with username)
- Mentions in comments and captions
- Basic engagement counts (likes are not available per-user via Graph API)

**What the API does NOT provide:**
- Per-user like data on Instagram (Graph API limitation — likes are aggregate only)
- Story views or DMs
- Private account activity

**Instagram V1 limitation:**
Per-user likes are not available via Instagram Graph API. Instagram V1 tracking is limited to: comments, mentions, and approved manual proof submissions. Document this limitation clearly in the UI.

**Matching approach:**
Instagram API returns `username` in comment objects. Employee records store `instagram_handle`. Matching is exact string match (case-insensitive).

---

## 9. Supabase Schema

```sql
-- ORGANISATIONS
create table organizations (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  slug                        text not null unique,
  -- LinkedIn credentials (stored server-side only)
  linkedin_company_url        text,
  linkedin_client_id          text,
  linkedin_client_secret      text,  -- never returned to client
  linkedin_access_token       text,  -- never returned to client
  linkedin_company_id         text,
  -- Instagram credentials (stored server-side only)
  instagram_app_id            text,
  instagram_app_secret        text,  -- never returned to client
  instagram_access_token      text,  -- never returned to client
  instagram_business_account_id text,
  instagram_handles           text[],
  created_at                  timestamptz default now() not null,
  updated_at                  timestamptz default now() not null
);

-- ORG MEMBERSHIP (multi-tenancy join table)
create table org_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'admin'
                check (role in ('owner', 'admin', 'viewer')),
  created_at  timestamptz default now() not null,
  unique(org_id, user_id)
);

-- EMPLOYEES
create table employees (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  name             text not null,
  email            text not null,
  department       text,
  title            text,
  -- Social profiles (required for engagement matching)
  linkedin_url     text,
  linkedin_id      text,   -- LinkedIn member URN, used for API matching
  instagram_handle text,   -- exact Instagram username, used for API matching
  avatar_url       text,
  -- Advocacy tracking (auto-maintained by trigger)
  total_points     numeric not null default 0,
  level            text not null default 'Newcomer',
  is_active        boolean not null default true,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null,
  unique(org_id, email)
);

-- POSTS (company-owned content only)
create table posts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  platform         text not null check (platform in ('linkedin', 'instagram')),
  post_url         text not null,
  platform_post_id text,
  title            text,
  content_preview  text,
  published_at     timestamptz,
  last_synced_at   timestamptz,
  -- Aggregate engagement counts (updated on sync)
  total_likes      integer not null default 0,
  total_comments   integer not null default 0,
  total_shares     integer not null default 0,
  total_reposts    integer not null default 0,
  total_mentions   integer not null default 0,
  status           text not null default 'pending'
                     check (status in ('pending', 'syncing', 'synced', 'error')),
  sync_error       text,
  created_at       timestamptz default now() not null
);

-- ENGAGEMENTS (individual employee actions on company posts)
create table engagements (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references posts(id) on delete cascade,
  employee_id     uuid references employees(id) on delete set null,
  platform_id     text,   -- raw LinkedIn URN or Instagram username pre-matching
  engagement_type text not null
                    check (engagement_type in ('like', 'comment', 'share', 'repost', 'mention')),
  points          numeric not null default 0,
  engaged_at      timestamptz,
  created_at      timestamptz default now() not null,
  unique(post_id, platform_id, engagement_type)
);

-- MANUAL SUBMISSIONS (proof upload when API data is unavailable)
create table manual_submissions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  employee_id     uuid not null references employees(id) on delete cascade,
  post_url        text,
  platform        text check (platform in ('linkedin', 'instagram')),
  engagement_type text check (engagement_type in ('like', 'comment', 'share', 'repost', 'mention')),
  screenshot_url  text,
  notes           text,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  points_awarded  numeric not null default 5,
  reviewer_notes  text,
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users(id),
  created_at      timestamptz default now() not null
);

-- SCORING RULES (per-org, defaults match PRD)
create table scoring_rules (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  action     text not null,   -- like, comment, share, repost, mention
  points     numeric not null default 0,
  updated_at timestamptz default now() not null,
  unique(org_id, action)
);

-- Default scoring rows inserted on org creation:
-- like=1, comment=3, share=5, repost=5, mention=2

-- BADGES (earned milestones)
create table badges (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  badge_key   text not null,
  earned_at   timestamptz default now() not null,
  unique(employee_id, badge_key)
);
```

**Level thresholds:**

| Level | Points |
|---|---|
| Newcomer | 0–49 |
| Rising Star | 50–199 |
| Champion | 200–499 |
| Legend | 500–999 |
| Ambassador | 1000+ |

---

## 10. Success Metrics

### V1 is successful when the marketing team can answer all five questions:

| Question | Measured by |
|---|---|
| Which employees engage most? | Leaderboard — top 10 by total_points |
| Which departments participate most? | Department ranking tab on leaderboard |
| Which posts receive the strongest support? | Content page — posts sorted by total engagements |
| What is the overall participation rate? | Dashboard — (employees with ≥1 engagement / total employees) × 100 |
| Who are our top advocates? | Dashboard — top 5 advocate cards |

### Quantitative targets (30 days post-launch):

| Metric | Target |
|---|---|
| Employee records imported | 100% of FarMart employees in the system |
| Posts tracked | All LinkedIn + Instagram posts from the last 90 days |
| LinkedIn API connected | Live and returning engagement data |
| Participation rate visible | Dashboard shows accurate % within 24 hours of a sync |
| Admin time saved | Marketing team no longer needs manual LinkedIn scanning |

---

## 11. Launch Checklist

### Infrastructure
- [ ] Supabase project created and schema applied
- [ ] RLS policies enabled and tested on all tables
- [ ] Dev RLS bypass policy (`org_id = user_id`) removed before production
- [ ] `instagram_handle` column added to `employees`
- [ ] `mention` added to `engagements.engagement_type` check constraint
- [ ] Default `scoring_rules` rows inserted for the FarMart org
- [ ] `001_org_credentials.sql` migration applied

### LinkedIn Integration
- [ ] LinkedIn Developer App created
- [ ] Community Management API or Marketing Developer Platform access approved
- [ ] Company page Organisation ID obtained
- [ ] OAuth flow returning valid access token
- [ ] Test: API returns reactions list for at least one FarMart post
- [ ] Test: API returns comments list for at least one FarMart post
- [ ] Employee LinkedIn IDs collected for at least 10 employees
- [ ] Matching: at least one engagement matched to an employee record

### Instagram Integration
- [ ] Instagram Business Account connected to Facebook Page
- [ ] Meta for Developers app created with `instagram_manage_insights` scope
- [ ] Access token obtained and stored in Integrations page
- [ ] Test: API returns comments for at least one FarMart Instagram post
- [ ] Employee Instagram handles collected for at least 10 employees
- [ ] Known limitation documented in UI: per-user likes not available via Instagram Graph API

### Data
- [ ] Full employee CSV imported (name, email, department, title)
- [ ] LinkedIn URLs / IDs added to employee records (at minimum, key employees)
- [ ] Instagram handles added to employee records
- [ ] All FarMart posts from last 90 days added to Content page
- [ ] First sync completed with at least one matched engagement

### Frontend
- [ ] Dashboard shows real data (not empty state)
- [ ] Leaderboard shows ranked employees with correct scores
- [ ] Content page shows all tracked posts with engagement counts
- [ ] Analytics page shows engagement trend and department performance
- [ ] Integrations page shows Connected status for LinkedIn
- [ ] Manual Submissions page accessible and functional

### Security
- [ ] `.env.local` not committed to git
- [ ] No secrets logged or returned to client
- [ ] RLS tested: user cannot read another org's data
- [ ] All credential fields confirmed write-only from client perspective

### Sign-off
- [ ] Marketing team can answer all 5 success questions from the dashboard
- [ ] Participation rate is accurate against a manually verified sample
- [ ] Top 5 advocates shown match the team's anecdotal knowledge
- [ ] CMO / marketing lead approves dashboard view

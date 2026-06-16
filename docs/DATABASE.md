# BrandPulse — Database

## Provider

**Supabase (Postgres)** — project `afukuconidqwssevbgbm`

Schema file: `supabase/schema.sql`

---

## Current Tables

### `organizations`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Matches `auth.users.id` for single-user orgs |
| name | text | Display name |
| slug | text unique | URL-safe identifier |
| linkedin_org_id | text? | LinkedIn company page ID |
| instagram_account_id | text? | Instagram Business account ID |
| linkedin_access_token | text? | OAuth token (encrypted at rest) |
| instagram_access_token | text? | OAuth token (encrypted at rest) |
| created_at | timestamptz | |

### `employees`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| org_id | uuid FK → organizations | |
| name | text | |
| email | text | |
| department | text? | One of: Marketing, Sales, Engineering, Operations, Design, HR, Finance |
| title | text? | Job title |
| linkedin_url | text? | Full profile URL |
| linkedin_id | text? | LinkedIn member URN for API matching |
| avatar_url | text? | Not yet populated |
| total_points | int default 0 | Denormalised sum, updated by trigger |
| level | text default 'Newcomer' | Derived from total_points |
| is_active | bool default true | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

> **Note:** `instagram_handle` is not a column in the DB yet — it is stored client-side in localStorage for offline mode. Add it as a nullable text column for production.

### `posts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| org_id | uuid FK → organizations | |
| linkedin_post_url | text | Used for both LinkedIn and Instagram URLs |
| linkedin_post_id | text? | Platform-specific post ID for API sync |
| title | text? | Admin-supplied label |
| content_preview | text? | First 280 chars of post body |
| published_at | timestamptz? | Post publish time |
| last_synced_at | timestamptz? | Last engagement sync time |
| total_likes | int default 0 | Denormalised |
| total_comments | int default 0 | Denormalised |
| total_shares | int default 0 | Denormalised |
| total_reposts | int default 0 | Denormalised |
| status | enum | `pending` `syncing` `synced` `error` `archived` |
| created_at | timestamptz | |

### `engagements`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| post_id | uuid FK → posts | |
| employee_id | uuid? FK → employees | Null if employee not matched yet |
| linkedin_id | text? | Raw platform member ID |
| engagement_type | enum | `like` `comment` `share` `repost` |
| points | numeric | Calculated at insert time |
| engaged_at | timestamptz | When the engagement occurred |
| created_at | timestamptz | |

### `badges`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| employee_id | uuid FK → employees | |
| badge_key | text | e.g. `first_post`, `top_advocate_q1` |
| earned_at | timestamptz | |

---

## Recommended Additions for MVP

### Add `instagram_handle` to employees
```sql
ALTER TABLE employees ADD COLUMN instagram_handle text;
```

### Add `platform` column to posts
```sql
ALTER TABLE posts ADD COLUMN platform text CHECK (platform IN ('linkedin', 'instagram', 'unknown')) DEFAULT 'linkedin';
```

### Add `teams` table
```sql
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE team_members (
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, employee_id)
);
```

### Add `campaigns` table
```sql
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date,
  end_date date,
  status text CHECK (status IN ('draft', 'active', 'ended')) DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE campaign_posts (
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, post_id)
);
```

### Add `notifications` table
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL,          -- 'new_post', 'weekly_report', 'drop_alert'
  payload jsonb DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### Add `activity_logs` table
```sql
CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id uuid,               -- admin user ID
  action text NOT NULL,        -- 'employee_added', 'post_tracked', etc.
  target_type text,            -- 'employee', 'post', 'badge'
  target_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

---

## Row Level Security (RLS)

All tables should have RLS enabled with an `org_id` policy:

```sql
-- Pattern for each table:
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_org_isolation"
  ON <table>
  USING (org_id = auth.uid());
```

The `supabase/fix-rls-recursion.sql` file contains a fix for the RLS recursion issue on `org_members`.

---

## Scoring Model

| Engagement | Points |
|-----------|--------|
| Like | 1 |
| Comment | 1.5 |
| Share | 2 |
| Repost | 3 |

Employee level thresholds:
- **Newcomer** — 0+ pts
- **Rising Star** — 50+ pts
- **Champion** — 200+ pts
- **Legend** — 500+ pts
- **Ambassador** — 1000+ pts

Source of truth: `src/constants/index.ts`

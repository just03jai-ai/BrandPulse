# BrandPulse — Architecture

## Overview

BrandPulse is an Employee Advocacy Intelligence Platform. It tracks which employees engage with company LinkedIn and Instagram posts, scores their activity, and surfaces a real-time leaderboard and analytics dashboard.

**Stack:** Next.js 16 (App Router) · TypeScript (strict) · Supabase (auth + Postgres) · Tailwind CSS v4 · Recharts · @base-ui/react

---

## Source Layout

```
src/
├── app/                        # Next.js App Router pages
│   ├── (app)/                  # Authenticated shell (sidebar layout)
│   │   ├── dashboard/          # Overview analytics page
│   │   ├── employees/          # Employee directory page
│   │   ├── leaderboard/        # Advocacy leaderboard page
│   │   ├── posts/              # Post tracking page
│   │   ├── settings/           # Platform settings page
│   │   └── layout.tsx          # App shell with Sidebar
│   ├── auth/callback/          # Supabase OAuth callback route
│   ├── login/                  # Login page
│   ├── globals.css
│   ├── layout.tsx              # Root layout (fonts, Toaster)
│   └── page.tsx                # Root redirect → /dashboard
│
├── components/
│   ├── layout/
│   │   └── sidebar.tsx         # App sidebar with nav + sign-out
│   └── ui/                     # Primitive UI components (Dialog, Input, etc.)
│
├── features/                   # Domain feature modules
│   └── employees/
│       ├── components/         # Employee-specific UI components
│       │   ├── CsvImportModal.tsx
│       │   ├── EmployeeFormModal.tsx
│       │   ├── EmployeeProfilePanel.tsx
│       │   └── index.ts        # Barrel export
│       ├── types.ts            # EmployeeWithIG, EmployeeFormData, helpers
│       └── utils.ts            # localStorage helpers (loadLocal, saveLocal)
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase client (createBrowserClient)
│   │   └── server.ts           # Server Supabase client (createServerClient)
│   └── utils/
│       ├── format.ts           # Shared formatters (getInitials, formatDate, avatarColor…)
│       └── utils.ts            # cn() Tailwind merge helper
│
├── constants/
│   └── index.ts                # Centralised: DEPARTMENTS, DEPT_COLORS, POINTS_MAP, etc.
│
├── types/
│   └── database.ts             # Supabase schema types + EmployeeLevel + getLevel()
│
└── proxy.ts                    # Auth middleware logic (used by middleware.ts)
```

---

## Data Flow

```
Browser → Next.js Server Component (page.tsx)
            │
            ├─ Supabase server client → Postgres query
            │
            └─ Pass data as props → Client Component (*-client.tsx)
                                        │
                                        ├─ Local state (useState)
                                        ├─ Supabase browser client (mutations)
                                        └─ localStorage (offline fallback)
```

### Offline Mode
When `NEXT_PUBLIC_SUPABASE_URL` is not set, `createClient()` returns `null`. All write paths check for `supabase !== null` and fall back to `localStorage` under the key `brandpulse_employees`.

---

## Key Modules

### `src/constants/index.ts`
Single source of truth for:
- `DEPARTMENTS` — ordered list of department names
- `DEPT_COLORS` — Tailwind classes for department pills (dark theme)
- `DEPT_BADGE_STYLES` — bordered Tailwind classes (leaderboard style)
- `DEPT_CHART_COLORS` — hex colours for Recharts
- `LEVEL_COLORS` — Tailwind classes for employee level badges
- `LEVEL_THRESHOLDS` — point thresholds per level
- `POINTS_MAP` — engagement type → points (like=1, comment=1.5, share=2, repost=3)
- `AVATAR_PALETTE` — colour palette for deterministic avatar colours

### `src/lib/utils/format.ts`
- `getInitials(name)` — "Jane Smith" → "JS"
- `formatDate(iso)` — ISO string → "Jun 16, 2026"
- `formatNumber(n)` — 1234567 → "1,234,567"
- `getPlatform(url)` — detects "linkedin" | "instagram" | "unknown"
- `getIgHandle(handle)` — normalises to "@handle" format
- `avatarColor(name)` — deterministic colour from AVATAR_PALETTE

### `src/features/employees/`
Feature-scoped module for everything employee-related:
- **types.ts** — `EmployeeWithIG`, `EmployeeFormData`, `EMPTY_FORM`, `formFromEmployee()`
- **utils.ts** — `makeLocalEmployee()`, `loadLocal()`, `saveLocal()`
- **components/** — `CsvImportModal`, `EmployeeFormModal`, `EmployeeProfilePanel`

---

## Supabase Schema

See [DATABASE.md](./DATABASE.md) for the full schema and recommended additions.

---

## Authentication

Supabase email/password auth. The middleware (`src/proxy.ts`) redirects unauthenticated users to `/login` and authenticated users away from `/login`. The `/auth/callback` route handles the OAuth token exchange.

---

## Rendering Strategy

| Page | Strategy | Why |
|------|----------|-----|
| `/dashboard` | Server Component → Client Component | Data fetched server-side, charts rendered client-side |
| `/employees` | Server Component → Client Component | Server fetch + client-side add/edit/delete |
| `/leaderboard` | Server Component → Client Component | Server fetch, client-side filter |
| `/posts` | Server Component → Client Component | Server fetch, client-side add/archive |
| `/settings` | Client Component only | UI state only, no server data needed |

---

## Performance Notes

- Each page fetches only the data it needs (no global store).
- `localStorage` fallback prevents blank states when Supabase is unconfigured.
- Recharts is loaded only on pages that need it (dashboard, leaderboard are separate chunks).
- No unnecessary `useEffect` polling — Supabase mutations update local state directly.

---

## Adding a New Feature

1. Create `src/features/<name>/` with `types.ts`, `utils.ts`, `components/`
2. Add the page under `src/app/(app)/<name>/`
3. Add a nav entry in `src/components/layout/sidebar.tsx`
4. Add the Supabase table in `supabase/schema.sql` and update `src/types/database.ts`

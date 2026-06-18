// ─── Departments ──────────────────────────────────────────────────────────────

export const DEPARTMENTS = [
  "Marketing",
  "Sales",
  "Engineering",
  "Operations",
  "Design",
  "HR",
  "Finance",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

// Tailwind badge classes for department pills
export const DEPT_COLORS: Record<string, string> = {
  Marketing: "bg-emerald-900/50 text-emerald-300",
  Sales: "bg-blue-900/50 text-blue-300",
  Engineering: "bg-orange-900/50 text-orange-300",
  Operations: "bg-purple-900/50 text-purple-300",
  Design: "bg-pink-900/50 text-pink-300",
  HR: "bg-teal-900/50 text-teal-300",
  Finance: "bg-violet-900/50 text-violet-300",
};

// Tailwind badge classes with border (leaderboard style)
export const DEPT_BADGE_STYLES: Record<string, string> = {
  Marketing: "bg-pink-900/40 text-pink-300 border border-pink-700/30",
  Sales: "bg-blue-900/40 text-blue-300 border border-blue-700/30",
  Engineering: "bg-cyan-900/40 text-cyan-300 border border-cyan-700/30",
  Operations: "bg-orange-900/40 text-orange-300 border border-orange-700/30",
  Design: "bg-purple-900/40 text-purple-300 border border-purple-700/30",
  HR: "bg-violet-900/40 text-violet-300 border border-violet-700/30",
  Finance: "bg-yellow-900/40 text-yellow-300 border border-yellow-700/30",
};

// Hex colors for Recharts / chart libraries
export const DEPT_CHART_COLORS: Record<string, string> = {
  Marketing: "#22c55e",
  Sales: "#3b82f6",
  Engineering: "#f97316",
  Operations: "#a855f7",
  Design: "#ec4899",
  HR: "#10b981",
  Finance: "#8b5cf6",
};

// ─── Levels ───────────────────────────────────────────────────────────────────

export const LEVEL_COLORS: Record<string, string> = {
  Bronze:   "bg-gray-800 text-gray-400",
  Silver:   "bg-blue-900/60 text-blue-300",
  Gold:     "bg-yellow-900/60 text-yellow-300",
  Platinum: "bg-violet-900/60 text-violet-300",
};

export const LEVEL_THRESHOLDS = {
  Platinum: 1000,
  Gold:     500,
  Silver:   100,
  Bronze:   0,
} as const;

// ─── Scoring ──────────────────────────────────────────────────────────────────

export const POINTS_MAP = {
  like:    1,
  comment: 3,
  share:   5,
  repost:  5,
  mention: 2,
} as const;

export type EngagementType = keyof typeof POINTS_MAP;

// ─── Avatar ───────────────────────────────────────────────────────────────────

export const AVATAR_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#06b6d4",
] as const;


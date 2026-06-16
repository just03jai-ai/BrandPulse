"use client";

import { useState, useMemo } from "react";
import { Trophy } from "lucide-react";
import { clsx } from "clsx";
import type { Employee } from "@/types/database";

type TimePeriod = "weekly" | "monthly" | "all-time";

interface LeaderboardEntry {
  employee: Employee;
  likes: number;
  comments: number;
  shares: number;
  reposts: number;
  score: number;
}

const AVATAR_PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

const DEPT_STYLES: Record<string, string> = {
  Design: "bg-purple-900/40 text-purple-300 border border-purple-700/30",
  Marketing: "bg-pink-900/40 text-pink-300 border border-pink-700/30",
  Sales: "bg-blue-900/40 text-blue-300 border border-blue-700/30",
  Engineering: "bg-cyan-900/40 text-cyan-300 border border-cyan-700/30",
  HR: "bg-violet-900/40 text-violet-300 border border-violet-700/30",
  Operations: "bg-orange-900/40 text-orange-300 border border-orange-700/30",
  Finance: "bg-yellow-900/40 text-yellow-300 border border-yellow-700/30",
};

const RANK_STYLES: Record<number, string> = {
  1: "bg-emerald-900/50 text-emerald-300 border border-emerald-700/30",
  2: "bg-blue-900/50 text-blue-300 border border-blue-700/30",
  3: "bg-orange-900/50 text-orange-300 border border-orange-700/30",
};

const TROPHY_COLORS: Record<number, string> = {
  1: "#f59e0b",
  2: "#9ca3af",
  3: "#cd7c4c",
};

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz =
    size === "lg" ? "w-14 h-14 text-xl" :
    size === "sm" ? "w-8 h-8 text-sm" :
    "w-9 h-9 text-sm";
  return (
    <div
      className={clsx("rounded-full flex items-center justify-center font-bold text-white flex-shrink-0", sz)}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function DeptBadge({ dept }: { dept: string | null }) {
  if (!dept) return <span className="text-gray-600 text-xs">—</span>;
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", DEPT_STYLES[dept] ?? "bg-gray-800 text-gray-400 border border-gray-700/30")}>
      {dept}
    </span>
  );
}

interface Props {
  employees: Employee[];
  engagementMap: Record<string, { likes: number; comments: number; shares: number; reposts: number }>;
}

export function LeaderboardClient({ employees, engagementMap }: Props) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all-time");
  const [deptFilter, setDeptFilter] = useState("All");

  const departments = useMemo(() => {
    const depts = new Set(
      employees.map((e) => e.department).filter((d): d is string => Boolean(d))
    );
    return ["All", ...Array.from(depts).sort()];
  }, [employees]);

  const allEntries: LeaderboardEntry[] = useMemo(() => {
    return employees
      .map((emp) => {
        const stats = engagementMap[emp.id] ?? { likes: 0, comments: 0, shares: 0, reposts: 0 };
        return { employee: emp, ...stats, score: emp.total_points };
      })
      .sort((a, b) => b.score - a.score);
  }, [employees, engagementMap]);

  const top3 = useMemo(() => allEntries.slice(0, 3), [allEntries]);

  const tableEntries =
    deptFilter === "All"
      ? allEntries
      : allEntries.filter((e) => e.employee.department === deptFilter);

  return (
    <div className="flex flex-col min-h-screen bg-[#0c0e15]">
      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
        <p className="text-gray-500 text-sm mt-1">Top employee advocates ranked by advocacy score</p>
      </div>

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="px-8 pt-6">
          <div className="bg-[#12151f] border border-white/5 rounded-xl p-6">
            <div className="grid grid-cols-3 gap-4">
              {top3.map((entry, i) => {
                const rank = i + 1;
                return (
                  <div
                    key={entry.employee.id}
                    className={clsx(
                      "flex flex-col items-center py-8 px-4 rounded-xl transition-colors",
                      rank === 1 && "bg-[#161b2a] border border-emerald-900/20"
                    )}
                  >
                    <Trophy className="w-8 h-8 mb-4" style={{ color: TROPHY_COLORS[rank] }} />
                    <Avatar name={entry.employee.name} size="lg" />
                    <p className="text-white font-semibold mt-3 text-base text-center">{entry.employee.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{entry.employee.department ?? "—"}</p>
                    <p className="text-4xl font-bold text-white mt-4">{entry.score}</p>
                    <p className="text-gray-500 text-xs mt-1">points</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-8 pt-5 space-y-3">
        <div className="flex items-center gap-2">
          {(["weekly", "monthly", "all-time"] as TimePeriod[]).map((t) => (
            <button
              key={t}
              onClick={() => setTimePeriod(t)}
              className={clsx(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                timePeriod === t
                  ? "bg-emerald-600 text-white"
                  : "text-gray-400 hover:text-gray-200 bg-[#12151f] border border-white/5"
              )}
            >
              {t === "weekly" ? "Weekly" : t === "monthly" ? "Monthly" : "All Time"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setDeptFilter(dept)}
              className={clsx(
                "px-3 py-1 rounded-lg text-sm font-medium transition-colors",
                deptFilter === dept
                  ? "bg-white text-gray-900"
                  : "text-gray-400 hover:text-gray-200 bg-[#12151f] border border-white/5"
              )}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pt-5 pb-4 flex-1">
        <div className="bg-[#12151f] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-20">Rank</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">👍 Likes</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">💬 Cmts</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">🔁 Shares</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Score</th>
              </tr>
            </thead>
            <tbody>
              {tableEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-gray-500 text-sm">
                    No employees to display.
                  </td>
                </tr>
              ) : (
                tableEntries.map((entry) => {
                  const rank = allEntries.indexOf(entry) + 1;
                  const rankStyle = RANK_STYLES[rank] ?? "bg-gray-800/50 text-gray-400";
                  return (
                    <tr
                      key={entry.employee.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.025] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className={clsx("inline-flex items-center justify-center rounded-full w-8 h-8 text-xs font-bold", rankStyle)}>
                          #{rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={entry.employee.name} size="sm" />
                          <div>
                            <p className="font-medium text-white text-sm">{entry.employee.name}</p>
                            <p className="text-xs text-gray-500">{entry.employee.title ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DeptBadge dept={entry.employee.department} />
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300 font-medium">{entry.likes}</td>
                      <td className="px-4 py-3 text-center text-gray-300 font-medium">{entry.comments}</td>
                      <td className="px-4 py-3 text-center text-gray-300 font-medium">{entry.shares}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-emerald-400 font-bold text-base">{entry.score}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Scoring key */}
        <div className="mt-4 flex items-center gap-6 text-xs text-gray-600">
          <span>Scoring:</span>
          <span>👍 Like = 1 pt</span>
          <span>💬 Comment = 3 pts</span>
          <span>🔁 Share = 5 pts</span>
          <span>↩️ Repost = 5 pts</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { Users, UserCheck, TrendingUp, FileText } from "lucide-react";

import { DEPT_CHART_COLORS } from "@/constants";

interface TopEmployee {
  id: string;
  name: string;
  department: string | null;
  total_points: number;
  level: string;
}

interface TopPost {
  id: string;
  title: string | null;
  post_url: string;
  platform: string;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_reposts: number;
  published_at: string | null;
  status: string;
}

interface Props {
  totalEmployees: number;
  activeAdvocates: number;
  participationRate: number;
  postsTracked: number;
  totalEngagements: number;
  topAdvocates: TopEmployee[];
  deptActivity: { dept: string; total: number; active: number }[];
  weeklyTrend: { week: string; advocates: number }[];
  topPosts: TopPost[];
  isConnected: boolean;
}

function StatCard({
  label, value, sub, icon: Icon, iconBg,
}: { label: string; value: string; sub: string; icon: React.ElementType; iconBg: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-4xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

export function DashboardClient({
  totalEmployees, activeAdvocates, participationRate, postsTracked, totalEngagements,
  topAdvocates, deptActivity, weeklyTrend, topPosts, isConnected,
}: Props) {
  const maxPts = topAdvocates[0]?.total_points || 1;

  return (
    <div className="p-8 min-h-screen bg-[#111]">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-3xl font-bold text-white">Overview</h1>
        <p className="text-gray-500 mt-1 text-sm">FarMart employee advocacy metrics — All time</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatCard label="Total Employees" value={totalEmployees.toString()} sub="Registered in directory" icon={Users} iconBg="bg-emerald-900/40" />
        <StatCard label="Active Advocates" value={activeAdvocates.toString()} sub="Engaged at least once" icon={UserCheck} iconBg="bg-emerald-900/40" />
        <StatCard label="Participation Rate" value={`${participationRate}%`} sub={activeAdvocates > 0 ? "Of enrolled employees" : "No engagements yet"} icon={TrendingUp} iconBg="bg-emerald-900/40" />
        <StatCard label="Posts Tracked" value={postsTracked.toString()} sub={`${totalEngagements.toLocaleString()} platform reach`} icon={FileText} iconBg="bg-emerald-900/40" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        {/* Participation Trend */}
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-0.5">Participation Trend</p>
          <p className="text-xs text-gray-500 mb-4">Weekly active advocates over 8 weeks</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="week" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1f1f1f", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#9ca3af" }}
                itemStyle={{ color: "#22c55e" }}
              />
              <Line
                type="monotone"
                dataKey="advocates"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: "#22c55e", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Department Activity */}
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-0.5">Department Activity</p>
          <p className="text-xs text-gray-500 mb-4">Active vs total employees</p>
          {deptActivity.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-gray-600 text-sm">No department data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deptActivity} layout="vertical" margin={{ top: 0, right: 8, left: 60, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="dept" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                <Tooltip
                  contentStyle={{ background: "#1f1f1f", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Bar
                  dataKey="active"
                  name="Active"
                  radius={[0, 4, 4, 0]}
                  fill="#22c55e"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  shape={(props: any) => {
                    const color = DEPT_CHART_COLORS[props.payload?.dept] ?? "#6b7280";
                    return <rect x={props.x} y={props.y} width={props.width} height={Math.max(props.height, 0)} fill={color} rx={4} />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top Advocates */}
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-4">Top Advocates</p>
          {topAdvocates.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No engagement data yet</p>
          ) : (
            <div className="space-y-3.5">
              {topAdvocates.map((emp, i) => (
                <div key={emp.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-5 flex-shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white font-medium truncate">{emp.name}</span>
                      <span className="text-xs text-emerald-400 font-semibold ml-2 flex-shrink-0">
                        {emp.total_points} pts
                      </span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1">
                      <div
                        className="bg-emerald-500 h-1 rounded-full"
                        style={{ width: `${Math.round((emp.total_points / maxPts) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">{emp.department}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Posts */}
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Top Tracked Posts</p>
            <p className="text-xs text-gray-500 mt-0.5">Platform-wide reach (likes + comments + shares + reposts)</p>
          </div>
          {topPosts.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No posts tracked yet</p>
          ) : (
            <div className="space-y-3">
              {topPosts.map((post) => {
                const isIG = post.platform === "instagram";
                const totalReach = post.total_likes + post.total_comments + post.total_shares + post.total_reposts;
                return (
                  <div key={post.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${isIG ? "bg-pink-900/50 text-pink-300" : "bg-blue-900/50 text-blue-300"}`}>
                      {isIG ? "IG" : "in"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{post.title ?? "Untitled"}</p>
                      <p className="text-xs text-gray-500">{post.published_at?.slice(0, 10) ?? "—"}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-emerald-400">{totalReach}</p>
                      <p className="text-[10px] text-gray-500">total reach</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isConnected && totalEngagements === 0 && postsTracked > 0 && (
        <div className="mt-4 flex items-start gap-3 bg-blue-950/40 border border-blue-800/40 rounded-xl p-4 text-sm text-blue-300">
          <span className="mt-0.5 shrink-0 text-blue-400">ℹ</span>
          <span>
            Posts are tracked but no engagement data has been synced yet.{" "}
            <span className="text-white font-medium">
              Use the Submissions page to manually log employee engagement,
            </span>{" "}
            or set up automated sync from Settings once LinkedIn / Instagram credentials are saved.
          </span>
        </div>
      )}

      {isConnected && postsTracked === 0 && (
        <div className="mt-4 flex items-start gap-3 bg-blue-950/40 border border-blue-800/40 rounded-xl p-4 text-sm text-blue-300">
          <span className="mt-0.5 shrink-0 text-blue-400">ℹ</span>
          <span>
            No posts tracked yet.{" "}
            <a href="/posts" className="text-white font-medium underline underline-offset-2 hover:text-blue-200">
              Go to Post Tracking
            </a>{" "}
            to add your first LinkedIn or Instagram post URL, then log employee engagement via Submissions.
          </span>
        </div>
      )}

      {!isConnected && (
        <div className="mt-4 bg-amber-950/50 border border-amber-800/50 rounded-xl p-4 text-sm text-amber-300">
          Supabase not connected — showing empty state. Add credentials to <code className="text-amber-200">.env.local</code>.
        </div>
      )}
    </div>
  );
}

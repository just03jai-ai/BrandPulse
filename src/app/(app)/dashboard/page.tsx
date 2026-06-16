import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Only fetch engagements from last 8 weeks (for trend chart) — not all time
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [employeesRes, postsRes, trendRes] = await Promise.all([
    supabase?.from("employees").select("id, name, department, total_points, level"),
    supabase
      ?.from("posts")
      .select("id, title, linkedin_post_url, total_likes, total_comments, total_shares, total_reposts, published_at, status")
      .order("published_at", { ascending: false })
      .limit(4),
    // Only recent engagements needed for the weekly trend chart
    supabase
      ?.from("engagements")
      .select("employee_id, created_at")
      .gte("created_at", eightWeeksAgo.toISOString()),
  ]);

  const employees = employeesRes?.data ?? [];
  const posts = postsRes?.data ?? [];
  const recentEngagements = trendRes?.data ?? [];

  // Stats from denormalised employee data — no full table scan needed
  const totalEmployees = employees.length;
  const activeAdvocates = employees.filter((e) => e.total_points > 0).length;
  const participationRate =
    totalEmployees > 0 ? Math.round((activeAdvocates / totalEmployees) * 100) : 0;

  // Totals from denormalised post columns — avoids fetching raw engagements
  const { totalLikes, totalComments, totalShares, totalReposts } = posts.reduce(
    (acc, p) => ({
      totalLikes: acc.totalLikes + p.total_likes,
      totalComments: acc.totalComments + p.total_comments,
      totalShares: acc.totalShares + p.total_shares,
      totalReposts: acc.totalReposts + p.total_reposts,
    }),
    { totalLikes: 0, totalComments: 0, totalShares: 0, totalReposts: 0 }
  );
  const totalEngagements = totalLikes + totalComments + totalShares + totalReposts;

  const topAdvocates = [...employees]
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 5);

  const depts = ["Marketing", "Sales", "Engineering", "Operations", "Design", "HR", "Finance"];
  const deptActivity = depts
    .map((dept) => ({
      dept,
      total: employees.filter((e) => e.department === dept).length,
      active: employees.filter((e) => e.department === dept && e.total_points > 0).length,
    }))
    .filter((d) => d.total > 0);

  // Weekly trend from limited recent engagements only
  const now = new Date();
  const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (7 - i) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const count = new Set(
      recentEngagements
        .filter((e) => {
          const d = new Date(e.created_at);
          return d >= weekStart && d < weekEnd && e.employee_id;
        })
        .map((e) => e.employee_id)
    ).size;
    return { week: `Wk ${i + 1}`, advocates: count };
  });

  return (
    <DashboardClient
      totalEmployees={totalEmployees}
      activeAdvocates={activeAdvocates}
      participationRate={participationRate}
      totalEngagements={totalEngagements}
      totalLikes={totalLikes}
      totalComments={totalComments}
      totalShares={totalShares}
      totalReposts={totalReposts}
      topAdvocates={topAdvocates}
      deptActivity={deptActivity}
      weeklyTrend={weeklyTrend}
      topPosts={posts}
      isConnected={!!supabase}
    />
  );
}

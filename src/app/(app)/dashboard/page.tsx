import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [employeesRes, postsRes, trendRes] = await Promise.all([
    supabase?.from("employees").select("id, name, department, total_points, level"),
    supabase
      ?.from("company_posts")
      .select("id, title, post_url, platform, total_likes, total_comments, total_shares, total_reposts, published_at, status")
      .neq("status", "archived")
      .order("published_at", { ascending: false }),
    supabase
      ?.from("engagement_events")
      .select("employee_id, created_at")
      .not("employee_id", "is", null)
      .gte("created_at", eightWeeksAgo.toISOString()),
  ]);

  const employees = employeesRes?.data ?? [];
  const posts = postsRes?.data ?? [];
  const recentEngagements = trendRes?.data ?? [];

  const totalEmployees = employees.length;
  const activeAdvocates = employees.filter((e) => e.total_points > 0).length;
  const participationRate =
    totalEmployees > 0 ? Math.round((activeAdvocates / totalEmployees) * 100) : 0;
  const postsTracked = posts.length;

  const totalEngagements = posts.reduce(
    (acc, p) => acc + p.total_likes + p.total_comments + p.total_shares + p.total_reposts,
    0
  );

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

  // Weekly trend — real date labels
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
          return d >= weekStart && d < weekEnd;
        })
        .map((e) => e.employee_id)
    ).size;
    const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { week: label, advocates: count };
  });

  return (
    <DashboardClient
      totalEmployees={totalEmployees}
      activeAdvocates={activeAdvocates}
      participationRate={participationRate}
      postsTracked={postsTracked}
      totalEngagements={totalEngagements}
      topAdvocates={topAdvocates}
      deptActivity={deptActivity}
      weeklyTrend={weeklyTrend}
      topPosts={posts.slice(0, 4)}
      isConnected={!!supabase}
    />
  );
}

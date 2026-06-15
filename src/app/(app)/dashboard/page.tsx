import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [employeesRes, engagementsRes, postsRes] = await Promise.all([
    supabase?.from("employees").select("id, name, department, total_points, level"),
    supabase?.from("engagements").select("engagement_type, points, created_at, employee_id"),
    supabase?.from("posts").select("id, title, linkedin_post_url, total_likes, total_comments, total_shares, total_reposts, published_at, status").order("published_at", { ascending: false }).limit(4),
  ]);

  const employees = employeesRes?.data ?? [];
  const engagements = engagementsRes?.data ?? [];
  const posts = postsRes?.data ?? [];

  const totalEmployees = employees.length;
  const activeAdvocates = new Set(engagements.map((e) => e.employee_id).filter(Boolean)).size;
  const participationRate = totalEmployees > 0 ? Math.round((activeAdvocates / totalEmployees) * 100) : 0;
  const totalEngagements = engagements.length;
  const totalLikes = engagements.filter((e) => e.engagement_type === "like").length;
  const totalComments = engagements.filter((e) => e.engagement_type === "comment").length;
  const totalShares = engagements.filter((e) => e.engagement_type === "share").length;
  const totalReposts = engagements.filter((e) => e.engagement_type === "repost").length;

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

  const now = new Date();
  const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (7 - i) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const count = new Set(
      engagements
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

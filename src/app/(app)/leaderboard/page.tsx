import { createClient } from "@/lib/supabase/server";
import { LeaderboardClient } from "./leaderboard-client";

export default async function LeaderboardPage() {
  const supabase = await createClient();

  // Run both queries in parallel instead of sequentially
  const [employeesRes, engagementsRes] = await Promise.all([
    supabase
      ?.from("employees")
      .select("id, name, email, department, title, total_points, level, is_active, linkedin_url, linkedin_id, avatar_url, org_id, created_at, updated_at")
      .eq("is_active", true)
      .order("total_points", { ascending: false }) ??
      Promise.resolve({ data: [] }),
    supabase
      ?.from("engagements")
      .select("employee_id, engagement_type") ??
      Promise.resolve({ data: [] }),
  ]);

  const employees = employeesRes?.data ?? [];
  const engagements = engagementsRes?.data ?? [];

  // Build engagement map in a single pass
  const engagementMap: Record<string, { likes: number; comments: number; shares: number; reposts: number }> = {};
  for (const eng of engagements) {
    if (!eng.employee_id) continue;
    const m = engagementMap[eng.employee_id] ??= { likes: 0, comments: 0, shares: 0, reposts: 0 };
    if (eng.engagement_type === "like") m.likes++;
    else if (eng.engagement_type === "comment") m.comments++;
    else if (eng.engagement_type === "share") m.shares++;
    else if (eng.engagement_type === "repost") m.reposts++;
  }

  return (
    <LeaderboardClient
      employees={employees ?? []}
      engagementMap={engagementMap}
    />
  );
}

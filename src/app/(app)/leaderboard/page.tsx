import { createClient } from "@/lib/supabase/server";
import { LeaderboardClient } from "./leaderboard-client";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = await createClient();

  // Fetch last 90 days of engagements (covers weekly/monthly/quarterly client-side filters)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [employeesRes, engagementsRes] = await Promise.all([
    supabase
      ?.from("employees")
      .select("id, name, email, department, department_id, title, total_points, level, is_active, linkedin_url, instagram_handle, org_id, created_at, updated_at")
      .eq("is_active", true)
      .order("total_points", { ascending: false }) ??
      Promise.resolve({ data: [] }),
    supabase
      ?.from("engagement_events")
      .select("employee_id, engagement_type, points, created_at")
      .gte("created_at", ninetyDaysAgo.toISOString()) ??
      Promise.resolve({ data: [] }),
  ]);

  const employees = employeesRes?.data ?? [];
  const recentEngagements = engagementsRes?.data ?? [];

  // Build engagement breakdown map (using the 90-day window for type counts)
  const engagementMap: Record<string, { likes: number; comments: number; shares: number; reposts: number; mentions: number }> = {};
  for (const eng of recentEngagements) {
    if (!eng.employee_id) continue;
    const m = engagementMap[eng.employee_id] ??= { likes: 0, comments: 0, shares: 0, reposts: 0, mentions: 0 };
    if (eng.engagement_type === "like") m.likes++;
    else if (eng.engagement_type === "comment") m.comments++;
    else if (eng.engagement_type === "share") m.shares++;
    else if (eng.engagement_type === "repost") m.reposts++;
    else if (eng.engagement_type === "mention") m.mentions++;
  }

  return (
    <LeaderboardClient
      employees={employees ?? []}
      engagementMap={engagementMap}
      recentEngagements={recentEngagements}
    />
  );
}

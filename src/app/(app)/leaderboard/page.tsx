import { createClient } from "@/lib/supabase/server";
import { LeaderboardClient } from "./leaderboard-client";

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: employees } = await (
    supabase
      ?.from("employees")
      .select("*")
      .eq("is_active", true)
      .order("total_points", { ascending: false }) ??
    Promise.resolve({ data: [] })
  );

  const { data: engagements } = await (
    supabase
      ?.from("engagements")
      .select("employee_id, engagement_type") ??
    Promise.resolve({ data: [] })
  );

  const engagementMap: Record<string, { likes: number; comments: number; shares: number; reposts: number }> = {};
  for (const eng of engagements ?? []) {
    if (!eng.employee_id) continue;
    if (!engagementMap[eng.employee_id]) {
      engagementMap[eng.employee_id] = { likes: 0, comments: 0, shares: 0, reposts: 0 };
    }
    const m = engagementMap[eng.employee_id];
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

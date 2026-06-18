import { createClient } from "@/lib/supabase/server";
import { SubmissionsClient } from "./submissions-client";

export default async function SubmissionsPage() {
  const supabase = await createClient();

  if (!supabase) {
    return <SubmissionsClient initialSubmissions={[]} employees={[]} orgId="" />;
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const orgId = membership?.org_id ?? "";

  const [submissionsRes, employeesRes] = await Promise.all([
    supabase
      .from("manual_submissions")
      .select(`
        id, employee_id, post_url, notes, status,
        points_awarded, reviewer_notes, reviewed_at, created_at,
        engagement_type, platform,
        employees(name)
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("employees")
      .select("id, name, email")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = (submissionsRes.data ?? []).map((s: any) => ({
    ...s,
    employee_name: s.employees?.name ?? "Unknown",
  }));

  return (
    <SubmissionsClient
      initialSubmissions={submissions}
      employees={employeesRes.data ?? []}
      orgId={orgId}
    />
  );
}

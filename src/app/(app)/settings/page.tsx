import { createClient } from "@/lib/supabase/server";
import { getOrganizationSettings } from "@/app/actions/organization";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  const [{ data: initialSettings }, accountRes] = await Promise.all([
    getOrganizationSettings(),
    supabase
      ?.from("company_social_accounts")
      .select("connection_status")
      .eq("platform", "linkedin")
      .eq("sync_enabled", true)
      .maybeSingle() ?? Promise.resolve({ data: null }),
  ]);

  const linkedInConnectionStatus: "connected" | "error" | "disconnected" =
    !accountRes?.data ? "disconnected" :
    accountRes.data.connection_status === "error" ? "error" :
    "connected";

  const linkedInParam = typeof params?.linkedin === "string" ? params.linkedin : undefined;
  const oauthResult = (linkedInParam === "connected" || linkedInParam === "error")
    ? linkedInParam as "connected" | "error"
    : undefined;

  const oauthReason = typeof params?.reason === "string" ? params.reason : undefined;
  const tabParam = typeof params?.tab === "string" ? params.tab : undefined;
  const initialTab: "linkedin" | "instagram" = tabParam === "instagram" ? "instagram" : "linkedin";

  return (
    <SettingsClient
      userEmail={user?.email ?? ""}
      initialSettings={initialSettings}
      linkedInConnectionStatus={linkedInConnectionStatus}
      oauthResult={oauthResult}
      oauthReason={oauthReason}
      initialTab={initialTab}
    />
  );
}

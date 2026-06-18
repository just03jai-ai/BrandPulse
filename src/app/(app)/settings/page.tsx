import { createClient } from "@/lib/supabase/server";
import { getOrganizationSettings } from "@/app/actions/organization";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  const { data: initialSettings } = await getOrganizationSettings();

  return (
    <SettingsClient
      userEmail={user?.email ?? ""}
      initialSettings={initialSettings}
    />
  );
}

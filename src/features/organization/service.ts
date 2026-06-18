/**
 * Server-only organisation service.
 * Import this ONLY in server components, server actions, or API routes.
 * Never import in client components — it exposes raw credentials.
 */
import { createClient } from "@/lib/supabase/server";
import type { SyncConfig, ValidationResult } from "./types";

/** Returns the org ID for the currently authenticated user, or null. */
export async function getOrgId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.org_id ?? null;
}

/**
 * Returns full credentials for sync jobs.
 * NEVER call from a client component or expose in an API response.
 */
export async function getSyncConfig(orgId: string): Promise<SyncConfig | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, linkedin_client_id, linkedin_client_secret, linkedin_access_token, " +
      "linkedin_company_id, linkedin_company_url, instagram_app_id, " +
      "instagram_app_secret, instagram_access_token, " +
      "instagram_business_account_id, instagram_handles"
    )
    .eq("id", orgId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .single() as unknown as { data: Record<string, any> | null; error: unknown };

  if (error || !data) return null;

  return {
    orgId: data.id,
    linkedin:
      data.linkedin_client_id && data.linkedin_access_token
        ? {
            clientId: data.linkedin_client_id,
            clientSecret: data.linkedin_client_secret ?? "",
            accessToken: data.linkedin_access_token,
            companyId: data.linkedin_company_id ?? "",
            companyUrl: data.linkedin_company_url ?? "",
          }
        : null,
    instagram:
      data.instagram_app_id && data.instagram_access_token
        ? {
            appId: data.instagram_app_id,
            appSecret: data.instagram_app_secret ?? "",
            accessToken: data.instagram_access_token,
            businessAccountId: data.instagram_business_account_id ?? "",
            handles: data.instagram_handles ?? [],
          }
        : null,
  };
}

/** Test LinkedIn access token against the API. */
export async function validateLinkedInCredentials(
  accessToken: string,
  companyId: string
): Promise<ValidationResult> {
  if (!accessToken) return { valid: false, error: "Access token is required." };

  try {
    const res = await fetch(
      `https://api.linkedin.com/v2/organizations/${companyId || "~"}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": "202304",
        },
      }
    );

    if (res.ok) return { valid: true };

    const body = await res.json().catch(() => ({}));
    return {
      valid: false,
      error: body?.message ?? `LinkedIn API returned ${res.status}`,
    };
  } catch {
    return { valid: false, error: "Could not reach LinkedIn API." };
  }
}

/** Test Instagram / Meta access token against the Graph API. */
export async function validateInstagramCredentials(
  accessToken: string
): Promise<ValidationResult> {
  if (!accessToken) return { valid: false, error: "Access token is required." };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
    );

    if (res.ok) return { valid: true };

    const body = await res.json().catch(() => ({}));
    return {
      valid: false,
      error: body?.error?.message ?? `Meta API returned ${res.status}`,
    };
  } catch {
    return { valid: false, error: "Could not reach Meta Graph API." };
  }
}

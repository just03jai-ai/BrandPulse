"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, validateLinkedInCredentials, validateInstagramCredentials } from "@/features/organization/service";
import type { OrgCredentialsPublic, OrgCredentialsInput, ValidationResult } from "@/features/organization/types";

type ActionResult<T = void> =
  | { data: T; error: null }
  | { data: null; error: string };

/** Load organisation settings safe for the client — secrets replaced with booleans. */
export async function getOrganizationSettings(): Promise<ActionResult<OrgCredentialsPublic>> {
  const supabase = await createClient();
  if (!supabase) return { data: null, error: "Not connected to database." };

  const orgId = await getOrgId();
  if (!orgId) return { data: null, error: "No organisation found." };

  const { data, error } = await supabase
    .from("organizations")
    .select(
      "linkedin_company_url, linkedin_client_id, linkedin_company_id, " +
      "linkedin_client_secret, linkedin_access_token, " +
      "instagram_app_id, instagram_business_account_id, instagram_handles, " +
      "instagram_app_secret, instagram_access_token"
    )
    .eq("id", orgId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .single() as unknown as { data: Record<string, any> | null; error: { message: string } | null };

  if (error || !data) return { data: null, error: error?.message ?? "No data." };

  // Strip secrets — only surface boolean indicators to the client
  return {
    data: {
      linkedin_company_url: data.linkedin_company_url,
      linkedin_client_id: data.linkedin_client_id,
      linkedin_company_id: data.linkedin_company_id,
      has_linkedin_client_secret: Boolean(data.linkedin_client_secret),
      has_linkedin_access_token: Boolean(data.linkedin_access_token),
      instagram_app_id: data.instagram_app_id,
      instagram_business_account_id: data.instagram_business_account_id,
      instagram_handles: data.instagram_handles,
      has_instagram_app_secret: Boolean(data.instagram_app_secret),
      has_instagram_access_token: Boolean(data.instagram_access_token),
    },
    error: null,
  };
}

/** Persist organisation settings. Empty-string values are ignored (leave existing). */
export async function updateOrganizationSettings(
  input: OrgCredentialsInput
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { data: null, error: "Not connected to database." };

  const orgId = await getOrgId();
  if (!orgId) return { data: null, error: "No organisation found." };

  // Only include fields that have a non-empty value so we never overwrite
  // existing secrets with blanks when only updating public fields.
  const patch: // eslint-disable-next-line @typescript-eslint/no-explicit-any
Record<string, any> = {};

  const publicFields = [
    "linkedin_company_url",
    "linkedin_client_id",
    "linkedin_company_id",
    "instagram_app_id",
    "instagram_business_account_id",
  ] as const;

  const secretFields = [
    "linkedin_client_secret",
    "linkedin_access_token",
    "instagram_app_secret",
    "instagram_access_token",
  ] as const;

  for (const key of publicFields) {
    if (input[key] !== undefined) patch[key] = input[key] || null;
  }

  // Secrets: only write when a non-empty value is explicitly supplied
  for (const key of secretFields) {
    const val = input[key as keyof OrgCredentialsInput] as string | undefined;
    if (val && val.trim().length > 0) patch[key] = val.trim();
  }

  if (input.instagram_handles !== undefined) {
    patch.instagram_handles = input.instagram_handles;
  }

  if (Object.keys(patch).length === 0) {
    return { data: null, error: "No changes to save." };
  }

  const { error } = await supabase
    .from("organizations")
    .update(patch)
    .eq("id", orgId);

  if (error) return { data: null, error: error.message };

  // After saving org credentials, sync company_social_accounts so the sync
  // route has a single table to read from. Re-read full org state so we can
  // upsert even when only partial fields were in this save call.
  const { data: orgData } = await (supabase
    .from("organizations")
    .select("linkedin_company_url, linkedin_company_id, linkedin_access_token")
    .eq("id", orgId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .single() as unknown as Promise<{ data: Record<string, any> | null }>);

  if (orgData?.linkedin_company_id && orgData?.linkedin_access_token) {
    const companyUrl: string = orgData.linkedin_company_url ?? "";
    const slug = companyUrl.includes("/company/")
      ? companyUrl.split("/company/")[1]?.split("/")[0] ?? null
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountRow: Record<string, any> = {
      org_id: orgId,
      platform: "linkedin",
      platform_account_id: orgData.linkedin_company_id,
      handle: slug,
      company_url: companyUrl || null,
      access_token: orgData.linkedin_access_token,
      sync_enabled: true,
      connection_status: "connected",
    };
    await supabase
      .from("company_social_accounts")
      .upsert(accountRow, { onConflict: "org_id,platform,platform_account_id" });
  }

  return { data: undefined as void, error: null };
}

/** Wipe all credentials for one platform (sets every field to NULL in the DB). */
export async function clearPlatformSettings(
  platform: "linkedin" | "instagram"
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { data: null, error: "Not connected to database." };

  const orgId = await getOrgId();
  if (!orgId) return { data: null, error: "No organisation found." };

  const patch =
    platform === "linkedin"
      ? {
          linkedin_company_url: null,
          linkedin_client_id: null,
          linkedin_company_id: null,
          linkedin_client_secret: null,
          linkedin_access_token: null,
        }
      : {
          instagram_app_id: null,
          instagram_business_account_id: null,
          instagram_handles: null,
          instagram_app_secret: null,
          instagram_access_token: null,
        };

  const { error } = await supabase.from("organizations").update(patch).eq("id", orgId);
  if (error) return { data: null, error: error.message };

  // Remove the corresponding social account row so Sync Now immediately
  // shows "Awaiting Connection" rather than using stale credentials.
  await supabase
    .from("company_social_accounts")
    .delete()
    .eq("org_id", orgId)
    .eq("platform", platform);

  // Reset posts that are stuck in error/syncing state back to pending so the
  // UI doesn't show stale "Sync Failed" badges after credentials are cleared.
  await supabase
    .from("company_posts")
    .update({ status: "pending", sync_error: null })
    .eq("org_id", orgId)
    .eq("platform", platform)
    .in("status", ["error", "syncing"]);

  return { data: undefined as void, error: null };
}

/** Test the stored LinkedIn access token against the LinkedIn API. */
export async function validateLinkedInConnection(): Promise<ValidationResult> {
  const supabase = await createClient();
  if (!supabase) return { valid: false, error: "Not connected." };

  const orgId = await getOrgId();
  if (!orgId) return { valid: false, error: "No organisation found." };

  const { data } = await (supabase
    .from("organizations")
    .select("linkedin_access_token, linkedin_company_id")
    .eq("id", orgId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .single() as unknown as Promise<{ data: Record<string, any> | null }>);

  if (!data?.linkedin_access_token) {
    return { valid: false, error: "No LinkedIn access token saved yet." };
  }

  return validateLinkedInCredentials(
    data.linkedin_access_token,
    data.linkedin_company_id ?? ""
  );
}

/** Test the stored Instagram/Meta access token against the Graph API. */
export async function validateInstagramConnection(): Promise<ValidationResult> {
  const supabase = await createClient();
  if (!supabase) return { valid: false, error: "Not connected." };

  const orgId = await getOrgId();
  if (!orgId) return { valid: false, error: "No organisation found." };

  const { data } = await (supabase
    .from("organizations")
    .select("instagram_access_token")
    .eq("id", orgId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .single() as unknown as Promise<{ data: Record<string, any> | null }>);

  if (!data?.instagram_access_token) {
    return { valid: false, error: "No Instagram access token saved yet." };
  }

  return validateInstagramCredentials(data.instagram_access_token);
}

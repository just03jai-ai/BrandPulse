import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/features/organization/service";

const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

function settingsRedirect(request: NextRequest, extra: Record<string, string>) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("tab", "linkedin");
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.delete("linkedin_oauth_state");
  return res;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code          = searchParams.get("code");
  const state         = searchParams.get("state");
  const error         = searchParams.get("error");
  const errorDesc     = searchParams.get("error_description") ?? "";

  // ── 1. LinkedIn-level authorization errors ──────────────────────────────────
  if (error) {
    console.error("[linkedin-oauth] Authorization error:", { error, errorDesc });
    let reason = "unknown_error";
    if (error === "access_denied") {
      reason = errorDesc.toLowerCase().includes("scope") ? "missing_scope_approval" : "access_denied";
    } else if (error === "unauthorized_client") {
      reason = "unauthorized_client";
    }
    return settingsRedirect(request, { linkedin: "error", reason });
  }

  // ── 2. CSRF state validation ─────────────────────────────────────────────────
  const rawCookie = request.cookies.get("linkedin_oauth_state")?.value ?? "";
  let storedNonce: string | null = null;
  let storedRedirectUri: string | null = null;
  try {
    const parsed = JSON.parse(rawCookie) as { nonce: string; redirectUri: string };
    storedNonce = parsed.nonce;
    storedRedirectUri = parsed.redirectUri;
  } catch { /* malformed or missing cookie */ }

  if (!state || !storedNonce || state !== storedNonce) {
    console.error("[linkedin-oauth] State mismatch — possible CSRF attempt");
    return settingsRedirect(request, { linkedin: "error", reason: "state_mismatch" });
  }

  if (!code) {
    return settingsRedirect(request, { linkedin: "error", reason: "missing_code" });
  }

  // ── 3. Load org credentials ──────────────────────────────────────────────────
  const supabase = await createClient();
  if (!supabase) {
    return settingsRedirect(request, { linkedin: "error", reason: "db_not_configured" });
  }

  const orgId = await getOrgId();
  if (!orgId) {
    return settingsRedirect(request, { linkedin: "error", reason: "not_authenticated" });
  }

  const { data: org } = await (supabase
    .from("organizations")
    .select("linkedin_client_id, linkedin_client_secret, linkedin_company_id, linkedin_company_url")
    .eq("id", orgId)
    .single() as unknown as Promise<{
      data: {
        linkedin_client_id: string | null;
        linkedin_client_secret: string | null;
        linkedin_company_id: string | null;
        linkedin_company_url: string | null;
      } | null;
    }>);

  if (!org?.linkedin_client_id || !org.linkedin_client_secret) {
    console.error("[linkedin-oauth] Missing client credentials for org", orgId);
    return settingsRedirect(request, { linkedin: "error", reason: "missing_credentials" });
  }

  // ── 4. Exchange code for access token ────────────────────────────────────────
  // Use the redirect_uri stored in the cookie — must exactly match the /start request
  const redirectUri = storedRedirectUri ?? `${request.nextUrl.origin}/api/auth/linkedin/callback`;

  let tokenData: {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  try {
    const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: org.linkedin_client_id,
        client_secret: org.linkedin_client_secret,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    tokenData = (await tokenRes.json()) as typeof tokenData;

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      console.error("[linkedin-oauth] Token exchange failed:", tokenData);
      const reason = tokenData.error === "invalid_grant" ? "invalid_grant" : "token_exchange_failed";
      return settingsRedirect(request, { linkedin: "error", reason });
    }
  } catch (err) {
    console.error("[linkedin-oauth] Token exchange network error:", err);
    return settingsRedirect(request, { linkedin: "error", reason: "network_error" });
  }

  const accessToken = tokenData.access_token!;
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // ── 5. Persist token to organizations table ──────────────────────────────────
  const { error: orgUpdateError } = await supabase
    .from("organizations")
    .update({ linkedin_access_token: accessToken })
    .eq("id", orgId);

  if (orgUpdateError) {
    console.error("[linkedin-oauth] Failed to save token to organizations:", orgUpdateError);
    return settingsRedirect(request, { linkedin: "error", reason: "db_save_failed" });
  }

  // ── 6. Upsert company_social_accounts ────────────────────────────────────────
  // company_social_accounts is the table the sync route reads — keep it in sync.
  if (org.linkedin_company_id) {
    const companyUrl = org.linkedin_company_url ?? null;
    const handle = companyUrl?.includes("/company/")
      ? (companyUrl.split("/company/")[1]?.split("/")[0] ?? null)
      : null;

    const { error: upsertError } = await supabase
      .from("company_social_accounts")
      .upsert(
        {
          org_id: orgId,
          platform: "linkedin",
          platform_account_id: org.linkedin_company_id,
          handle,
          company_url: companyUrl,
          access_token: accessToken,
          token_expires_at: expiresAt,
          sync_enabled: true,
          connection_status: "connected",
          sync_error: null,
          is_active: true,
        },
        { onConflict: "org_id,platform,platform_account_id" }
      );

    if (upsertError) {
      // Token is saved to organizations — sync will still work. Log but don't block.
      console.error("[linkedin-oauth] Failed to upsert company_social_accounts:", upsertError);
    }
  }

  console.log("[linkedin-oauth] OAuth completed for org", orgId, { expiresAt });
  return settingsRedirect(request, { linkedin: "connected" });
}

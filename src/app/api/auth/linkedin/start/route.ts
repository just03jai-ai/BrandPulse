import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/features/organization/service";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
// r_organization_social: read post analytics; openid + profile: verify identity
const SCOPES = "r_organization_social openid profile";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/settings?tab=linkedin&linkedin=error&reason=db_not_configured", request.url)
    );
  }

  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.redirect(
      new URL("/settings?tab=linkedin&linkedin=error&reason=not_authenticated", request.url)
    );
  }

  const { data: org } = await (supabase
    .from("organizations")
    .select("linkedin_client_id, linkedin_company_id")
    .eq("id", orgId)
    .single() as unknown as Promise<{
      data: { linkedin_client_id: string | null; linkedin_company_id: string | null } | null;
    }>);

  if (!org?.linkedin_client_id) {
    return NextResponse.redirect(
      new URL("/settings?tab=linkedin&linkedin=error&reason=missing_client_id", request.url)
    );
  }

  if (!org.linkedin_company_id) {
    return NextResponse.redirect(
      new URL("/settings?tab=linkedin&linkedin=error&reason=missing_company_id", request.url)
    );
  }

  // CSRF nonce — stored in cookie, validated in /callback
  const nonce = crypto.randomUUID();
  const redirectUri = `${request.nextUrl.origin}/api/auth/linkedin/callback`;

  // Store both nonce and redirectUri so /callback uses the exact same redirect_uri
  const statePayload = JSON.stringify({ nonce, redirectUri });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: org.linkedin_client_id,
    redirect_uri: redirectUri,
    state: nonce,
    scope: SCOPES,
  });

  const response = NextResponse.redirect(`${LINKEDIN_AUTH_URL}?${params.toString()}`);
  response.cookies.set("linkedin_oauth_state", statePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes
    sameSite: "lax",
    path: "/",
  });

  return response;
}

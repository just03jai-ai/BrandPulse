import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/features/organization/service";
import { POINTS_MAP } from "@/constants";

// ── LinkedIn post URN extraction ───────────────────────────────────────────────
// LinkedIn post URLs embed the share URN in several formats:
//   /feed/update/urn:li:activity:1234/
//   /feed/update/urn:li:ugcPost:1234/
//   /posts/company-slug-ugcPost-1234-XXXX/

function extractLinkedInUrn(postUrl: string, storedUrn: string | null): string | null {
  if (storedUrn) return storedUrn;

  const urnMatch = postUrl.match(/urn:li:(ugcPost|activity|share|article):(\d+)/);
  if (urnMatch) return `urn:li:${urnMatch[1]}:${urnMatch[2]}`;

  const slugMatch = postUrl.match(/ugcPost-(\d+)/);
  if (slugMatch) return `urn:li:ugcPost:${slugMatch[1]}`;

  return null;
}

// Normalize LinkedIn URL → comparable path so trailing-slash / www. differences
// don't prevent a match between the API response and our stored linkedin_url.
function normalizeLinkedInUrl(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?linkedin\.com/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface PostStats {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
}

interface EngagementRecord {
  actorUrn: string;
  profileUrl: string | null;
  type: "like" | "comment";
  engagedAt: string;
}

type SyncPost = { id: string; post_url: string; platform_post_id: string | null };
type EmpRow   = { id: string; linkedin_url: string | null };

// ── LinkedIn aggregate stats ───────────────────────────────────────────────────
// Returns total like/comment/share counts for a post (per organization).
// Requires r_organization_social scope.

async function fetchPostStats(
  companyId: string,
  shareUrn: string,
  accessToken: string
): Promise<PostStats> {
  const orgUrn = `urn:li:organization:${companyId}`;
  const url =
    `https://api.linkedin.com/v2/organizationalEntityShareStatistics` +
    `?q=organizationalEntity` +
    `&organizationalEntity=${encodeURIComponent(orgUrn)}` +
    `&shares[0]=${encodeURIComponent(shareUrn)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": "202304",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (res.status === 401) {
      console.error("[linkedin-sync] 401 from LinkedIn API — token invalid or expired", { shareUrn });
      throw new Error("LinkedIn token invalid or expired. Re-save your access token in Settings.");
    }
    if (res.status === 403) {
      console.error("[linkedin-sync] 403 from LinkedIn API — missing r_organization_social permission", { shareUrn });
      throw new Error("LinkedIn token lacks required permissions (r_organization_social scope needed).");
    }
    const errObj = body?.error as Record<string, unknown> | undefined;
    const msg = (body?.message as string) ?? (errObj?.message as string) ?? `LinkedIn API returned ${res.status}`;
    console.error("[linkedin-sync] LinkedIn API error", { status: res.status, shareUrn, message: msg });
    throw new Error(msg);
  }

  const data   = await res.json() as Record<string, unknown>;
  const elems  = (data.elements as Record<string, unknown>[]) ?? [];
  const stats  = (elems[0]?.totalShareStatistics ?? {}) as Record<string, number>;

  return {
    likes:       stats.likeCount       ?? 0,
    comments:    stats.commentCount    ?? 0,
    shares:      stats.shareCount      ?? 0,
    impressions: stats.impressionCount ?? 0,
  };
}

// ── LinkedIn individual engagements ───────────────────────────────────────────
// Calls socialActions/{urn}/likes and /comments to get per-person engagement.
// Returns empty array if the API call fails or the scope is missing — the
// caller degrades gracefully rather than failing the whole sync.

async function fetchPostEngagements(
  shareUrn: string,
  accessToken: string
): Promise<EngagementRecord[]> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": "202304",
    "X-Restli-Protocol-Version": "2.0.0",
  };
  const signal = AbortSignal.timeout(15_000);
  // Request publicProfileUrl so we can match against employees.linkedin_url.
  const proj = encodeURIComponent("(elements*(actor,actor~(publicProfileUrl),created))");
  const results: EngagementRecord[] = [];

  // Likes
  try {
    const likesRes = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(shareUrn)}/likes` +
      `?projection=${proj}&count=100`,
      { headers, signal }
    );
    if (likesRes.ok) {
      const data = await likesRes.json() as Record<string, unknown>;
      for (const elem of (data.elements as Record<string, unknown>[]) ?? []) {
        const actor    = elem.actor as string | undefined;
        const actorExt = elem["actor~"] as Record<string, string> | undefined;
        if (!actor) continue;
        results.push({
          actorUrn:  actor,
          profileUrl: actorExt?.publicProfileUrl ?? null,
          type:      "like",
          engagedAt: elem.created
            ? new Date((elem.created as Record<string, number>).time).toISOString()
            : new Date().toISOString(),
        });
      }
    }
  } catch { /* missing r_organization_social scope — degrade gracefully */ }

  // Comments
  try {
    const commentsRes = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(shareUrn)}/comments` +
      `?projection=${proj}&count=100`,
      { headers, signal }
    );
    if (commentsRes.ok) {
      const data = await commentsRes.json() as Record<string, unknown>;
      for (const elem of (data.elements as Record<string, unknown>[]) ?? []) {
        const actor    = elem.actor as string | undefined;
        const actorExt = elem["actor~"] as Record<string, string> | undefined;
        if (!actor) continue;
        results.push({
          actorUrn:  actor,
          profileUrl: actorExt?.publicProfileUrl ?? null,
          type:      "comment",
          engagedAt: elem.created
            ? new Date((elem.created as Record<string, number>).time).toISOString()
            : new Date().toISOString(),
        });
      }
    }
  } catch { /* missing scope — degrade gracefully */ }

  return results;
}

// ── POST /api/sync/linkedin ────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // ── 1. Read LinkedIn account ────────────────────────────────────────────────
  const { data: account } = await (supabase
    .from("company_social_accounts")
    .select("id, platform_account_id, access_token, sync_enabled")
    .eq("org_id", orgId)
    .eq("platform", "linkedin")
    .eq("sync_enabled", true)
    .maybeSingle() as unknown as Promise<{ data: Record<string, string> | null }>);

  if (!account) {
    console.warn("[linkedin-sync] No LinkedIn account row found for org", orgId, "— credentials not saved yet");
    return NextResponse.json(
      { error: "LinkedIn is not connected. Add credentials in Settings before syncing." },
      { status: 400 }
    );
  }
  if (!account.access_token) {
    console.warn("[linkedin-sync] LinkedIn account row exists but access_token is null for org", orgId);
    return NextResponse.json(
      { error: "No LinkedIn access token found. Re-save credentials in Settings." },
      { status: 400 }
    );
  }

  // ── 2. Load posts + employees in parallel ───────────────────────────────────
  const [postsRes, empsRes] = await Promise.all([
    supabase
      .from("company_posts")
      .select("id, post_url, platform_post_id")
      .eq("org_id", orgId)
      .eq("platform", "linkedin")
      .neq("status", "archived") as unknown as Promise<{ data: SyncPost[] | null }>,

    supabase
      .from("employees")
      .select("id, linkedin_url")
      .eq("org_id", orgId)
      .not("linkedin_url", "is", null) as unknown as Promise<{ data: EmpRow[] | null }>,
  ]);

  const posts = postsRes.data;
  if (!posts || posts.length === 0) {
    return NextResponse.json({ message: "No LinkedIn posts to sync.", posts_synced: 0 });
  }

  // Build normalised-URL → employee_id map for O(1) matching
  const employeeByUrl: Record<string, string> = {};
  for (const emp of empsRes.data ?? []) {
    if (emp.linkedin_url) {
      employeeByUrl[normalizeLinkedInUrl(emp.linkedin_url)] = emp.id;
    }
  }

  // ── 3. Open sync_log ────────────────────────────────────────────────────────
  const { data: syncLog } = await (supabase
    .from("sync_logs")
    .insert({
      org_id:     orgId,
      account_id: account.id,
      platform:   "linkedin",
      status:     "started",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single() as unknown as Promise<{ data: { id: string } | null }>);

  // Mark all pending posts as syncing
  await supabase
    .from("company_posts")
    .update({ status: "syncing" })
    .eq("org_id", orgId)
    .eq("platform", "linkedin")
    .eq("status", "pending");

  // ── 4. Sync each post ───────────────────────────────────────────────────────
  let postsSynced   = 0;
  let eventsFetched = 0;
  let eventsMatched = 0;
  let lastError: string | null = null;

  for (const post of posts) {
    const urn = extractLinkedInUrn(post.post_url, post.platform_post_id ?? null);

    if (!urn) {
      console.warn("[linkedin-sync] Cannot extract URN from post URL", { postId: post.id, postUrl: post.post_url });
      await supabase.from("company_posts").update({
        status:         "error",
        sync_error:     "Could not extract post URN from URL. Paste the full /feed/update/ URL.",
        last_synced_at: new Date().toISOString(),
      }).eq("id", post.id);
      lastError = "Post URN not found in URL";
      continue;
    }

    try {
      // ── 4a. Aggregate stats ────────────────────────────────────────────────
      const stats = await fetchPostStats(
        account.platform_account_id,
        urn,
        account.access_token
      );

      await supabase.from("company_posts").update({
        total_likes:        stats.likes,
        total_comments:     stats.comments,
        total_shares:       stats.shares,
        total_impressions:  stats.impressions,
        platform_post_id:   urn,
        status:             "synced",
        sync_error:         null,
        last_synced_at:     new Date().toISOString(),
      }).eq("id", post.id);

      postsSynced++;

      // ── 4b. Individual engagements — who liked / commented ─────────────────
      // socialActions requires r_organization_social scope. If unavailable,
      // fetchPostEngagements returns [] and we skip without failing the sync.
      const engagements = await fetchPostEngagements(urn, account.access_token);
      eventsFetched += engagements.length;

      for (const eng of engagements) {
        const normUrl    = eng.profileUrl ? normalizeLinkedInUrl(eng.profileUrl) : null;
        const employeeId = normUrl ? (employeeByUrl[normUrl] ?? null) : null;

        await (supabase
          .from("engagement_events")
          .upsert({
            org_id:            orgId,
            post_id:           post.id,
            employee_id:       employeeId,
            platform:          "linkedin",
            engagement_type:   eng.type,
            platform_actor_id: eng.actorUrn,
            points:            employeeId ? POINTS_MAP[eng.type] : 0,
            engaged_at:        eng.engagedAt,
          }, { onConflict: "post_id,platform_actor_id,engagement_type" })
        );

        if (employeeId) eventsMatched++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown sync error";
      console.error("[linkedin-sync] Post sync failed", { postId: post.id, postUrl: post.post_url, urn, error: msg });
      await supabase.from("company_posts").update({
        status:         "error",
        sync_error:     msg,
        last_synced_at: new Date().toISOString(),
      }).eq("id", post.id);
      lastError = msg;
    }
  }

  // ── 5. Close sync_log ───────────────────────────────────────────────────────
  const finalStatus =
    postsSynced === posts.length ? "success"
    : postsSynced > 0            ? "partial"
    :                              "error";

  if (syncLog?.id) {
    await supabase.from("sync_logs").update({
      status:         finalStatus,
      events_fetched: eventsFetched,
      events_matched: eventsMatched,
      error_message:  lastError,
      completed_at:   new Date().toISOString(),
    }).eq("id", syncLog.id);
  }

  // ── 6. Update account connection_status ─────────────────────────────────────
  await supabase.from("company_social_accounts").update({
    connection_status: finalStatus === "error" ? "error" : "connected",
    sync_error:        lastError,
    last_sync_at:      new Date().toISOString(),
  }).eq("id", account.id);

  return NextResponse.json({
    status:          finalStatus,
    posts_processed: posts.length,
    posts_synced:    postsSynced,
    events_fetched:  eventsFetched,
    events_matched:  eventsMatched,
    error:           lastError,
  });
}

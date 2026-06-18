import { createClient } from "@/lib/supabase/server";
import { PostTracking } from "./post-tracking";

export default async function PostsPage() {
  const supabase = await createClient();

  const { data: posts, error } = await (
    supabase
      ?.from("company_posts")
      .select("id, org_id, account_id, platform, post_url, platform_post_id, title, content_preview, published_at, last_synced_at, total_likes, total_comments, total_shares, total_reposts, total_mentions, sync_error, status, created_at")
      .neq("status", "archived")
      .order("created_at", { ascending: false }) ??
    Promise.resolve({ data: [], error: null })
  );

  return <PostTracking initialPosts={posts ?? []} error={error?.message} />;
}

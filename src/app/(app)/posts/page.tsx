import { createClient } from "@/lib/supabase/server";
import { PostTracking } from "./post-tracking";

export default async function PostsPage() {
  const supabase = await createClient();

  const { data: posts, error } = await (
    supabase
      ?.from("posts")
      .select("id, org_id, linkedin_post_url, linkedin_post_id, title, content_preview, published_at, last_synced_at, total_likes, total_comments, total_shares, total_reposts, status, created_at")
      .order("created_at", { ascending: false }) ??
    Promise.resolve({ data: [], error: null })
  );

  return <PostTracking initialPosts={posts ?? []} error={error?.message} />;
}

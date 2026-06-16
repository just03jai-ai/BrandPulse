import { createClient } from "@/lib/supabase/server";
import { PostTracking } from "./post-tracking";

export default async function PostsPage() {
  const supabase = await createClient();

  const { data: posts, error } = await (
    supabase
      ?.from("posts")
      .select("*")
      .order("created_at", { ascending: false }) ??
    Promise.resolve({ data: [], error: null })
  );

  return <PostTracking initialPosts={posts ?? []} error={error?.message} />;
}

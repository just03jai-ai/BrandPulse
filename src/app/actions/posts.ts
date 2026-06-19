"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/features/organization/service";

export async function deletePost(postId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Not connected." };

  const orgId = await getOrgId();
  if (!orgId) return { error: "No organisation found." };

  const { error } = await supabase
    .from("company_posts")
    .delete()
    .eq("id", postId)
    .eq("org_id", orgId);

  if (error) return { error: error.message };

  // Cascade in DB handles engagement_events deletion + score recount via trigger.
  // Revalidate all affected pages so router cache is cleared immediately.
  revalidatePath("/posts");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");

  return { error: null };
}

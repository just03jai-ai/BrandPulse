"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/features/organization/service";

export async function deleteSubmission(
  submissionId: string,
  isApproved: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Not connected." };

  const orgId = await getOrgId();
  if (!orgId) return { error: "No organisation found." };

  // Approved submissions have a matching engagement_events row (manual:id).
  // Delete it first so the score recount trigger fires before the submission is gone.
  if (isApproved) {
    await supabase
      .from("engagement_events")
      .delete()
      .eq("platform_actor_id", `manual:${submissionId}`)
      .is("post_id", null);
  }

  const { error } = await supabase
    .from("manual_submissions")
    .delete()
    .eq("id", submissionId)
    .eq("org_id", orgId);

  if (error) return { error: error.message };

  revalidatePath("/submissions");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");

  return { error: null };
}

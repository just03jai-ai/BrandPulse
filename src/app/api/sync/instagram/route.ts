import { NextResponse } from "next/server";

// Placeholder — Instagram sync not yet implemented.
// When built, this route will:
//   1. Load org credentials from organizations table
//   2. Call Meta Graph API to fetch likers/commenters per tracked post
//   3. Match platform_actor_id (Instagram username) to employees.instagram_handle
//   4. Write matched events to engagement_events
//   5. Update company_posts.status → 'synced' and refresh last_synced_at
export async function POST() {
  return NextResponse.json(
    {
      status: "not_implemented",
      message: "Instagram sync is coming soon. Configure credentials in Settings to prepare.",
    },
    { status: 501 }
  );
}

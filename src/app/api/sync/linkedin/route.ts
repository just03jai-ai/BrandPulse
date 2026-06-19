import { NextResponse } from "next/server";

// Placeholder — LinkedIn sync not yet implemented.
// When built, this route will:
//   1. Load org credentials from organizations table
//   2. Call LinkedIn API to fetch likers/commenters/sharers per tracked post
//   3. Match platform_actor_id (member URN) to employees.linkedin_url
//   4. Write matched events to engagement_events
//   5. Update company_posts.status → 'synced' and refresh last_synced_at
export async function POST() {
  return NextResponse.json(
    {
      status: "not_implemented",
      message: "LinkedIn sync is coming soon. Configure credentials in Settings to prepare.",
    },
    { status: 501 }
  );
}

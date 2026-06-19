export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Row types ────────────────────────────────────────────────────────────────

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  linkedin_company_url: string | null;
  linkedin_client_id: string | null;
  linkedin_company_id: string | null;
  linkedin_client_secret: string | null;
  linkedin_access_token: string | null;
  instagram_app_id: string | null;
  instagram_business_account_id: string | null;
  instagram_handles: string[] | null;
  instagram_app_secret: string | null;
  instagram_access_token: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EmployeeRow {
  id: string;
  org_id: string;
  department_id: string | null;
  name: string;
  email: string;
  department: string | null;
  title: string | null;
  linkedin_url: string | null;
  instagram_handle: string | null;
  is_active: boolean;
  total_points: number;
  level: string;
  created_at: string;
  updated_at: string;
}

export interface PostRow {
  id: string;
  org_id: string;
  account_id: string | null;
  platform: "linkedin" | "instagram";
  post_url: string;
  platform_post_id: string | null;
  title: string | null;
  content_preview: string | null;
  published_at: string | null;
  last_synced_at: string | null;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_reposts: number;
  total_mentions: number;
  sync_error: string | null;
  status: "pending" | "syncing" | "synced" | "error" | "archived";
  created_at: string;
}

export interface EngagementRow {
  id: string;
  org_id: string;
  post_id: string | null;  // NULL for manual submission events (no post FK)
  employee_id: string | null;
  platform: "linkedin" | "instagram";
  engagement_type: "like" | "comment" | "share" | "repost" | "mention";
  platform_actor_id: string;
  points: number;
  engaged_at: string;
  created_at: string;
}

export interface ManualSubmissionRow {
  id: string;
  org_id: string;
  employee_id: string;
  post_url: string | null;
  engagement_type: "like" | "comment" | "share" | "repost" | "mention" | null;
  platform: "linkedin" | "instagram" | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  points_awarded: number;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface SyncLogRow {
  id: string;
  org_id: string;
  account_id: string | null;
  post_id: string | null;
  platform: "linkedin" | "instagram";
  status: "started" | "success" | "error" | "partial";
  events_fetched: number;
  events_matched: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

// ─── Insert / Update types ────────────────────────────────────────────────────

export type EmployeeInsert = Omit<EmployeeRow,
  "id" | "created_at" | "updated_at" | "total_points" | "level" | "department_id"
>;
export type EmployeeUpdate = Partial<Omit<EmployeeRow, "id" | "created_at" | "updated_at">>;

export type PostInsert = Omit<PostRow,
  "id" | "created_at" | "total_likes" | "total_comments" | "total_shares" | "total_reposts" | "total_mentions" | "sync_error" | "account_id"
>;
export type PostUpdate = Partial<Omit<PostRow, "id" | "created_at">>;

export type EngagementInsert = Omit<EngagementRow, "id" | "created_at">;

export type ManualSubmissionInsert = Omit<ManualSubmissionRow,
  "id" | "created_at" | "reviewer_notes" | "reviewed_at"
>;

// ─── Supabase Database schema ─────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: Omit<OrganizationRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<OrganizationRow, "id" | "created_at">>;
      };
      employees: {
        Row: EmployeeRow;
        Insert: EmployeeInsert;
        Update: EmployeeUpdate;
      };
      company_posts: {
        Row: PostRow;
        Insert: PostInsert;
        Update: PostUpdate;
      };
      engagement_events: {
        Row: EngagementRow;
        Insert: EngagementInsert;
        Update: Partial<EngagementInsert>;
      };
      manual_submissions: {
        Row: ManualSubmissionRow;
        Insert: ManualSubmissionInsert;
        Update: Partial<ManualSubmissionInsert>;
      };
      sync_logs: {
        Row: SyncLogRow;
        Insert: Omit<SyncLogRow, "id">;
        Update: Partial<Omit<SyncLogRow, "id">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

// ─── Convenience aliases ──────────────────────────────────────────────────────

export type Organization    = OrganizationRow;
export type Employee        = EmployeeRow;
export type CompanyPost     = PostRow;
export type Post            = PostRow;  // backwards-compat alias
export type EngagementEvent = EngagementRow;
export type ManualSubmission  = ManualSubmissionRow;
export type SyncLog         = SyncLogRow;

// ─── Domain helpers ───────────────────────────────────────────────────────────

export type EmployeeLevel = "Bronze" | "Silver" | "Gold" | "Platinum";

export function getLevel(points: number): EmployeeLevel {
  if (points >= 1000) return "Platinum";
  if (points >= 500)  return "Gold";
  if (points >= 100)  return "Silver";
  return "Bronze";
}

export { POINTS_MAP } from "@/constants";

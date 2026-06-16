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
  linkedin_org_id: string | null;
  instagram_account_id: string | null;
  linkedin_access_token: string | null;
  instagram_access_token: string | null;
  created_at: string;
}

export interface EmployeeRow {
  id: string;
  org_id: string;
  name: string;
  email: string;
  department: string | null;
  title: string | null;
  linkedin_url: string | null;
  linkedin_id: string | null;
  instagram_handle?: string | null;
  avatar_url: string | null;
  total_points: number;
  level: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostRow {
  id: string;
  org_id: string;
  linkedin_post_url: string;
  linkedin_post_id: string | null;
  title: string | null;
  content_preview: string | null;
  published_at: string | null;
  last_synced_at: string | null;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_reposts: number;
  status: "pending" | "syncing" | "synced" | "error" | "archived";
  created_at: string;
}

export interface EngagementRow {
  id: string;
  post_id: string;
  employee_id: string | null;
  linkedin_id: string | null;
  engagement_type: "like" | "comment" | "share" | "repost";
  points: number;
  engaged_at: string;
  created_at: string;
}

export interface BadgeRow {
  id: string;
  employee_id: string;
  badge_key: string;
  earned_at: string;
}

// ─── Insert / Update types ────────────────────────────────────────────────────

export type EmployeeInsert = Omit<EmployeeRow, "id" | "created_at" | "updated_at" | "total_points" | "level" | "instagram_handle">;
export type EmployeeUpdate = Partial<Omit<EmployeeRow, "id" | "created_at" | "updated_at">>;

export type PostInsert = Omit<PostRow, "id" | "created_at" | "total_likes" | "total_comments" | "total_shares" | "total_reposts">;
export type PostUpdate = Partial<Omit<PostRow, "id" | "created_at">>;

export type EngagementInsert = Omit<EngagementRow, "id" | "created_at">;

// ─── Supabase Database schema ─────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: Omit<OrganizationRow, "id" | "created_at">;
        Update: Partial<Omit<OrganizationRow, "id" | "created_at">>;
      };
      employees: {
        Row: EmployeeRow;
        Insert: EmployeeInsert;
        Update: EmployeeUpdate;
      };
      posts: {
        Row: PostRow;
        Insert: PostInsert;
        Update: PostUpdate;
      };
      engagements: {
        Row: EngagementRow;
        Insert: EngagementInsert;
        Update: Partial<EngagementInsert>;
      };
      badges: {
        Row: BadgeRow;
        Insert: Omit<BadgeRow, "id" | "earned_at">;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

// ─── Convenience aliases ──────────────────────────────────────────────────────

export type Organization = OrganizationRow;
export type Employee = EmployeeRow;
export type Post = PostRow;
export type Engagement = EngagementRow;
export type Badge = BadgeRow;

// ─── Domain helpers ───────────────────────────────────────────────────────────

export type EmployeeLevel =
  | "Newcomer"
  | "Rising Star"
  | "Champion"
  | "Legend"
  | "Ambassador";

export function getLevel(points: number): EmployeeLevel {
  if (points >= 1000) return "Ambassador";
  if (points >= 500) return "Legend";
  if (points >= 200) return "Champion";
  if (points >= 50) return "Rising Star";
  return "Newcomer";
}

export const POINTS_MAP = {
  like: 1,
  comment: 1.5,
  share: 2,
  repost: 3,
} as const;

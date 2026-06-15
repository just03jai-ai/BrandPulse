import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const configured = SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 10;

// Returns null when Supabase env vars are placeholder values.
export function createClient() {
  if (!configured) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

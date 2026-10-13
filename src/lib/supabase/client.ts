import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/config";

let client: SupabaseClient | null = null;

/** Browser client using the public anon key. The service-role key is never used in this app. */
export function getSupabaseBrowserClient(): SupabaseClient {
  client ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Supabase mode activates only when both public env vars are present (and demo isn't forced). */
export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) && process.env.NEXT_PUBLIC_DEMO_MODE !== "true";

/** Google sign-in shows whenever Supabase auth is on. Set NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=false to hide it. */
export const isGoogleAuthEnabled = isSupabaseConfigured && process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH !== "false";

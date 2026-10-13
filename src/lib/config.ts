export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Supabase mode activates only when both public env vars are present (and demo isn't forced). */
export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) && process.env.NEXT_PUBLIC_DEMO_MODE !== "true";

export const isGoogleAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/config";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only; the proxy refreshes them.
        }
      },
    },
  });
}

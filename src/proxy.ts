import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/config";
import { AbuseGuard, MAX_URL_LENGTH, clientIp, hasSessionCookie, isLoopback, routeClass } from "@/lib/rate-limit";

const PUBLIC_PATHS = ["/login", "/auth", "/join"];

// One guard per server instance. See SECURITY.md for what this does and doesn't cover.
const guard = new AbuseGuard();
const guardEnabled = process.env.RATE_LIMIT_DISABLED !== "true";

function reject(status: 429 | 414, retryAfterSec?: number) {
  return new NextResponse(status === 429 ? "Too many requests. Please slow down and try again shortly." : "Request URL too long.", {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(retryAfterSec ? { "Retry-After": String(retryAfterSec) } : {}),
    },
  });
}

/**
 * First stop for every page request:
 *  1. refuse oversized URLs and clients that are over their request budget (cheap, before any other work);
 *  2. refresh the Supabase session cookie and send signed-out visitors to /login (Supabase mode only).
 */
export async function proxy(request: NextRequest) {
  if (request.url.length > MAX_URL_LENGTH) return reject(414);

  const path = request.nextUrl.pathname;
  const ip = clientIp(request.headers);
  // No client address, or one that's just this machine (local development): nothing to key on, so don't throttle.
  if (guardEnabled && ip && !isLoopback(ip)) {
    const verdict = guard.check(ip, routeClass(path));
    if (!verdict.ok) return reject(429, verdict.retryAfterSec);
  }

  if (!isSupabaseConfigured) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  // A visitor with no session cookie is signed out by definition. Answering that here, without asking Supabase,
  // means a flood of anonymous requests can't be turned into a flood of calls to the Supabase Auth API.
  if (!hasSessionCookie(request.cookies.getAll())) {
    if (isPublic) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)"],
};

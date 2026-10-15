/**
 * A small, dependency-free abuse guard for the request proxy.
 *
 * It is a best-effort first line of defense: state lives in memory on whichever server instance handles the
 * request, so it won't add up across instances. The real protection against large floods is the platform
 * (Vercel's network-level DDoS mitigation and its Firewall rate-limit rules, see SECURITY.md). What this does
 * give you is a cheap early rejection for one noisy client, so it never reaches rendering or Supabase.
 */

export interface LimitResult {
  ok: boolean;
  /** Whole seconds the caller should wait before trying again (0 when ok). */
  retryAfterSec: number;
}

interface Bucket {
  tokens: number;
  updated: number;
}

/** Token bucket per key: `capacity` requests can burst, refilled at `refillPerSec`. Memory is bounded by `maxKeys`. */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    private readonly maxKeys = 10_000,
  ) {}

  take(key: string, now = Date.now(), cost = 1): LimitResult {
    let b = this.buckets.get(key);
    if (b) {
      const elapsed = Math.max(0, (now - b.updated) / 1000);
      b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerSec);
      b.updated = now;
      // Re-insert so the Map's order stays "least recently used first".
      this.buckets.delete(key);
    } else {
      b = { tokens: this.capacity, updated: now };
    }
    this.buckets.set(key, b);
    this.evict();

    if (b.tokens >= cost) {
      b.tokens -= cost;
      return { ok: true, retryAfterSec: 0 };
    }
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cost - b.tokens) / this.refillPerSec)) };
  }

  /** Drops the least recently seen keys once the map is full, so a flood of fake IPs can't exhaust memory. */
  private evict() {
    const over = this.buckets.size - this.maxKeys;
    if (over <= 0) return;
    const drop = over + Math.ceil(this.maxKeys * 0.1);
    let i = 0;
    for (const key of this.buckets.keys()) {
      if (i++ >= drop) break;
      this.buckets.delete(key);
    }
  }

  get size() {
    return this.buckets.size;
  }
}

export type RouteClass = "page" | "auth";

export interface GuardOptions {
  page: { capacity: number; refillPerSec: number };
  auth: { capacity: number; refillPerSec: number };
  /** Rejected requests within `strikeWindowMs` that earn a temporary block. */
  strikes: number;
  strikeWindowMs: number;
  blockMs: number;
  maxKeys?: number;
}

export const DEFAULT_GUARD: GuardOptions = {
  // Generous: one real person (and an office or campus sharing an IP) browsing, with Next's link prefetching.
  page: { capacity: 240, refillPerSec: 6 },
  // Sign-in, sign-up and OAuth callbacks are the expensive, abusable ones.
  auth: { capacity: 30, refillPerSec: 0.5 },
  strikes: 8,
  strikeWindowMs: 60_000,
  blockMs: 10 * 60_000,
};

/**
 * Per-IP limiter with two route classes, plus a temporary block for clients that keep hammering after being
 * told to stop. Blocked clients are turned away with one Map lookup, before any other work happens.
 */
export class AbuseGuard {
  private readonly page: RateLimiter;
  private readonly auth: RateLimiter;
  private readonly strikes = new Map<string, number[]>();
  private readonly blocked = new Map<string, number>();

  constructor(private readonly opts: GuardOptions = DEFAULT_GUARD) {
    const maxKeys = opts.maxKeys ?? 10_000;
    this.page = new RateLimiter(opts.page.capacity, opts.page.refillPerSec, maxKeys);
    this.auth = new RateLimiter(opts.auth.capacity, opts.auth.refillPerSec, maxKeys);
  }

  check(ip: string, kind: RouteClass, now = Date.now()): LimitResult {
    const until = this.blocked.get(ip);
    if (until !== undefined) {
      if (until > now) return { ok: false, retryAfterSec: Math.ceil((until - now) / 1000) };
      this.blocked.delete(ip);
    }

    const result = (kind === "auth" ? this.auth : this.page).take(ip, now);
    if (result.ok) return result;

    // Count recent rejections; enough of them in a short time means this client isn't backing off.
    const recent = (this.strikes.get(ip) ?? []).filter((t) => now - t < this.opts.strikeWindowMs);
    recent.push(now);
    this.strikes.set(ip, recent);
    this.trim();
    if (recent.length >= this.opts.strikes) {
      this.blocked.set(ip, now + this.opts.blockMs);
      this.strikes.delete(ip);
      return { ok: false, retryAfterSec: Math.ceil(this.opts.blockMs / 1000) };
    }
    return result;
  }

  private trim() {
    const cap = this.opts.maxKeys ?? 10_000;
    for (const map of [this.strikes, this.blocked] as Map<string, unknown>[]) {
      if (map.size <= cap) continue;
      let i = 0;
      for (const key of map.keys()) {
        if (i++ >= Math.ceil(cap * 0.1)) break;
        map.delete(key);
      }
    }
  }

  isBlocked(ip: string, now = Date.now()) {
    return (this.blocked.get(ip) ?? 0) > now;
  }
}

/** Header names, best source first. Vercel sets x-real-ip / x-forwarded-for itself, so a client can't spoof them there. */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : null;
}

/** Local traffic (your own machine in development) is never throttled. */
export function isLoopback(ip: string): boolean {
  return ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1" || ip.startsWith("127.");
}

const AUTH_PREFIXES = ["/login", "/auth", "/join"];

export function routeClass(pathname: string): RouteClass {
  return AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ? "auth" : "page";
}

/** Longest URL we'll process. Real URLs here are far shorter; huge ones are junk or probing. */
export const MAX_URL_LENGTH = 2048;

/** True when the request carries a Supabase session cookie, so only those requests are worth a session check. */
export function hasSessionCookie(cookies: { name: string }[]): boolean {
  return cookies.some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
}

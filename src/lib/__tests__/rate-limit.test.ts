import { describe, expect, it } from "vitest";
import { AbuseGuard, RateLimiter, clientIp, hasSessionCookie, isLoopback, routeClass } from "../rate-limit";

describe("RateLimiter", () => {
  it("lets a burst through up to capacity, then refuses", () => {
    const rl = new RateLimiter(3, 1);
    const t = 1_000_000;
    expect([rl.take("a", t).ok, rl.take("a", t).ok, rl.take("a", t).ok]).toEqual([true, true, true]);
    const denied = rl.take("a", t);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterSec).toBe(1);
  });

  it("refills over time and tells the caller how long to wait", () => {
    const rl = new RateLimiter(2, 0.5);
    const t = 5_000;
    rl.take("a", t);
    rl.take("a", t);
    expect(rl.take("a", t).retryAfterSec).toBe(2);
    expect(rl.take("a", t + 1_000).ok).toBe(false); // half a token so far
    expect(rl.take("a", t + 2_500).ok).toBe(true);
  });

  it("never refills past capacity", () => {
    const rl = new RateLimiter(2, 10);
    rl.take("a", 0);
    expect(rl.take("a", 3_600_000).ok).toBe(true);
    expect(rl.take("a", 3_600_000).ok).toBe(true);
    expect(rl.take("a", 3_600_000).ok).toBe(false);
  });

  it("keeps clients separate", () => {
    const rl = new RateLimiter(1, 0.001);
    expect(rl.take("a", 0).ok).toBe(true);
    expect(rl.take("a", 0).ok).toBe(false);
    expect(rl.take("b", 0).ok).toBe(true);
  });

  it("bounds memory when a flood of different keys arrives", () => {
    const rl = new RateLimiter(5, 1, 100);
    for (let i = 0; i < 5_000; i++) rl.take(`ip-${i}`, i);
    expect(rl.size).toBeLessThanOrEqual(100);
    // The most recent client is still tracked.
    expect(rl.take("ip-4999", 5_000).ok).toBe(true);
  });
});

describe("AbuseGuard", () => {
  const opts = {
    page: { capacity: 2, refillPerSec: 0.1 },
    auth: { capacity: 1, refillPerSec: 0.1 },
    strikes: 3,
    strikeWindowMs: 10_000,
    blockMs: 60_000,
  };

  it("applies the tighter limit to auth routes", () => {
    const g = new AbuseGuard(opts);
    expect(g.check("1.1.1.1", "auth", 0).ok).toBe(true);
    expect(g.check("1.1.1.1", "auth", 0).ok).toBe(false);
    expect(g.check("2.2.2.2", "page", 0).ok).toBe(true);
    expect(g.check("2.2.2.2", "page", 0).ok).toBe(true);
    expect(g.check("2.2.2.2", "page", 0).ok).toBe(false);
  });

  it("blocks a client that keeps going after being refused, then lets it back in", () => {
    const g = new AbuseGuard(opts);
    g.check("9.9.9.9", "page", 0);
    g.check("9.9.9.9", "page", 0);
    expect(g.check("9.9.9.9", "page", 0).ok).toBe(false); // strike 1
    expect(g.check("9.9.9.9", "page", 1).ok).toBe(false); // strike 2
    const third = g.check("9.9.9.9", "page", 2); // strike 3 -> blocked
    expect(third.ok).toBe(false);
    expect(third.retryAfterSec).toBe(60);
    expect(g.isBlocked("9.9.9.9", 5_000)).toBe(true);
    // Even after tokens would have refilled, the block holds...
    expect(g.check("9.9.9.9", "page", 30_000).ok).toBe(false);
    // ...and lifts when the time is up.
    expect(g.check("9.9.9.9", "page", 61_000).ok).toBe(true);
    expect(g.isBlocked("9.9.9.9", 61_000)).toBe(false);
  });

  it("forgets old strikes", () => {
    const g = new AbuseGuard(opts);
    g.check("5.5.5.5", "auth", 0);
    expect(g.check("5.5.5.5", "auth", 0).ok).toBe(false); // strike 1
    expect(g.check("5.5.5.5", "auth", 1).ok).toBe(false); // strike 2
    // A long pause (past the strike window), a normal request, then one refusal: the early strikes have aged out.
    expect(g.check("5.5.5.5", "auth", 11_000).ok).toBe(true);
    expect(g.check("5.5.5.5", "auth", 11_000).ok).toBe(false);
    expect(g.isBlocked("5.5.5.5", 11_000)).toBe(false);
  });
});

describe("request helpers", () => {
  const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n] ?? null });

  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIp(headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4");
    expect(clientIp(headers({ "x-forwarded-for": "7.7.7.7, 10.0.0.1" }))).toBe("7.7.7.7");
    expect(clientIp(headers({}))).toBeNull();
  });

  it("recognizes this machine so local development isn't throttled", () => {
    expect(["::1", "127.0.0.1", "::ffff:127.0.0.1"].every(isLoopback)).toBe(true);
    expect(isLoopback("203.0.113.9")).toBe(false);
    expect(isLoopback("10.0.0.1")).toBe(false);
  });

  it("classifies auth-sensitive routes", () => {
    expect(routeClass("/login")).toBe("auth");
    expect(routeClass("/auth/callback")).toBe("auth");
    expect(routeClass("/join/abc123")).toBe("auth");
    expect(routeClass("/dashboard")).toBe("page");
    expect(routeClass("/loginx")).toBe("page");
  });

  it("only treats Supabase auth cookies as a session", () => {
    expect(hasSessionCookie([{ name: "sb-abcdef-auth-token" }])).toBe(true);
    expect(hasSessionCookie([{ name: "sb-abcdef-auth-token.0" }])).toBe(true);
    expect(hasSessionCookie([{ name: "theme" }, { name: "sb-other" }])).toBe(false);
    expect(hasSessionCookie([])).toBe(false);
  });
});

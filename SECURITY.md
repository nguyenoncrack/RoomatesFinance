# Abuse and DDoS protection

A real DDoS is a flood of traffic from many machines. It is stopped at the **network edge**, in front of your code, so most of the protection for this app lives in Vercel and Supabase settings, not in the repo. The code adds the layers it can: it refuses obvious abuse cheaply, it never turns anonymous traffic into database work, and it caps what any one account can do.

## What the app does

| Layer | Where | What it does |
| --- | --- | --- |
| Request guard | `src/proxy.ts`, `src/lib/rate-limit.ts` | Per-IP token bucket: about 240 page requests with a refill of 6 a second, and a stricter 30 requests with 0.5 a second refill on `/login`, `/auth` and `/join/…`. A client that keeps going after being refused (8 refusals in a minute) is blocked for 10 minutes and turned away with a single lookup. URLs over 2,048 characters get a 414. |
| No amplification | `src/proxy.ts` | A visitor with no Supabase session cookie is treated as signed out without calling Supabase, so a flood of anonymous requests can't become a flood of Auth API calls. |
| Per-account limits | `supabase/migrations/20261019000000_rate_limits.sql` | Database triggers cap how often one signed-in account can create households (10/hour), invitations (30/hour), joins (40/hour), expenses (300 per 10 min), payments (60 per 10 min) and repeats (30/hour). They hold even if someone calls Supabase directly and skips the website. |
| Hardening headers | `next.config.ts` | HSTS, `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy, and no `X-Powered-By`. |
| Already in place | `supabase/migrations/…` | Writes only through validated RPCs, row-level security on every table, idempotent request ids, 192-bit invite tokens stored hashed, single-use style limits on invites. |

Limits you should know about:

- The request guard keeps its counts in memory on whichever server instance handles the request. Several instances don't share counts, so treat it as a first filter for one noisy client, not as a cap on a distributed attack. The Vercel Firewall below is the real control.
- Everyone behind one shared IP (an office, a campus network) shares one budget. The defaults are generous for that reason.
- Local traffic (`localhost`) is never throttled. Set `RATE_LIMIT_DISABLED=true` to switch the request guard off entirely, for example in automated tests.
- Behind a proxy other than Vercel, make sure it sets `X-Real-IP` (or `X-Forwarded-For`) itself and strips any value the client sent, or clients could spoof their address.

## Turn these on (dashboards)

**Vercel**

1. **DDoS mitigation** is automatic and always on for every project. There is nothing to enable.
2. **Attack Challenge Mode** (Project → Firewall): switch it on while you're under attack. Visitors get a short browser check and automated traffic is turned away. Turn it off afterwards.
3. **Firewall rate limit rule** (Project → Firewall → Configure → add rule): for example, limit `/login`, `/auth/*` and `/join/*` to about 20 requests a minute per IP, and everything else to about 300 a minute, action "Rate limit" or "Challenge". This is shared across all instances, unlike the in-app guard. Which rule types you can use depends on your plan.
4. **Bot protection** (Project → Firewall): enable the managed bot ruleset in "log" first, then "challenge".
5. **Spend management** (Team Settings → Billing): set a budget alert and, if you want, a hard cap, so a flood can't run up a bill.

**Supabase**

1. **Authentication → Rate Limits**: lower the limits for sign-ups and sign-ins per IP, email sends per hour, and token refreshes to values that fit a small friend group.
2. **Authentication → Attack Protection**: turn on CAPTCHA (hCaptcha or Cloudflare Turnstile). It also needs a widget in the sign-in form; ask and I'll add it.
3. **Project Settings → API**: keep the maximum rows returned small. All the app's queries are scoped to one household.
4. **Usage and billing**: set alerts and use the spend cap so abuse can't turn into surprise costs.
5. Apply the migration `20261019000000_rate_limits.sql` (SQL editor or `npx supabase db push`).

## If you are under attack

1. Turn on Vercel **Attack Challenge Mode**.
2. Look at Vercel Firewall traffic and Supabase logs for the busiest IPs, paths and countries; add a rule to block or challenge them.
3. If one account is the source, delete it from Supabase Auth (its history stays, anonymized) or revoke its sessions.
4. Turn Attack Challenge Mode off when traffic is back to normal.

## Reporting a problem

If you find a security issue, please tell the repository owner directly rather than opening a public issue.

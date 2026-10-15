# PennyPincher

Split shared expenses with your roommates, see who owes what, and settle up with as few payments as possible.

- **Households**: create several, invite roommates with expiring links, switch between them.
- **Expenses**: equal, custom-amount, percentage (must total 100%), or weighted-share splits, with a live per-person breakdown before you save. Optional notes and receipt uploads.
- **Debt balancing**: each person's net balance is computed in integer cents, then a deterministic greedy pass matches debtors to creditors. You can switch between "Simplified" and "Original debts" (expense by expense).
- **Repeats**: "Add again" chips reopen a recent expense with the same payer and split, dated today. Any new expense can repeat weekly or monthly; due repeats are added when someone opens the app (missed ones are caught up, at most 12 at a time).
- **Settle day**: an optional weekly or monthly day set by the owner. On and after it, the dashboard reminds you to settle, but only while you owe or are owed money.
- **Settle up**: record Venmo, Zelle, cash, or other payments made outside the app, including partial ones. A payment you send is saved as pending and the recipient is notified to accept or reject it; only the recipient can confirm. Accepting completes it and updates balances, rejecting leaves balances alone, and either way the sender is notified. Payments you receive can be marked completed right away.
- **Delete account**: Settings has a "Delete account" card. It closes your login for good, signs you out, and keeps your past expenses for your roommates under the name "Deleted user". It's blocked while you owe or are owed money, or while you're the only owner of a household that still has other roommates. Deleting a user straight from the Supabase dashboard works too and leaves the same anonymous history behind.
- **Notifications**: a bell in the header lists confirmation requests and responses, delivered live through Supabase Realtime, with Accept/Reject inline. New ones also pop a toast.
- **History**: search and filter by category, payer, roommate, and date. Expenses can be edited or deleted (soft delete with an audit trail).
- **Dashboard**: summary cards, who-pays-whom, balances, recent activity, and charts for spending by category, by month, and by roommate.
- **Help**: an Elfsight AI chatbot sits in the bottom-right of every page (including sign-in). On phones it sits above the tab bar so it does not cover Add Expense.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, Lucide, Recharts, Framer Motion, and Supabase.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:4317
```

With no environment variables set, the app runs in **demo mode**. It seeds a household ("UCSB Apartment": Alex, Ben, Chris and Maya, with six months of history) plus a second "Tahoe Ski Trip" household, and keeps everything in `localStorage`. Demo mode enforces the same rules as the database: membership, cent totals, edit permissions, and duplicate-submit protection. Use **Settings → Demo controls** to view the app as another roommate or reset the data. In demo mode an invite link adds a new local roommate, and it only works in the browser that created it.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 4317 |
| `npm test` | Unit tests (Vitest) for splitting, balancing, rounding, and reimbursements |
| `npm run typecheck` | Generates route types, then runs `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | Production build / server on port 4317 |

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema. Either paste each file in `supabase/migrations/` into the SQL editor in order and run it, or use the CLI:
   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```
   This creates the tables, RLS policies, RPC functions, the private `receipts` storage bucket, and the realtime publication entries.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API). Restart `npm run dev`.
4. In **Authentication → URL Configuration**, add `http://localhost:4317/auth/callback` (and your production URL) to the redirect allow-list.
5. Google sign-in: enable the Google provider under **Authentication → Providers** (add your Google OAuth client ID and secret, and copy Supabase's callback URL into the Google console). The sign-in and sign-up pages show "Continue with Google" automatically whenever Supabase is configured; set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=false` to hide it.

Once both keys are set, signed-out visitors are redirected to `/login`. New users create a household or open an invite link.

### How the database protects the money

- Clients can only **read** financial tables, and RLS limits reads to households you're an active member of. Every write goes through a `SECURITY DEFINER` RPC: `create_expense`, `update_expense`, `delete_expense`, `record_settlement` (a payer's own record is always pending), `set_settlement_status` (only the recipient can accept or reject), `mark_notifications_read`, `create_household`, `create_invitation`, `accept_invitation`, `leave_household`, and `rename_household`. Each RPC checks membership and permissions and validates amounts inside a single transaction.
- Money is stored as `bigint` cents. A deferred constraint trigger guarantees an expense's splits always sum to its amount. Negative amounts and non-member participants are rejected.
- Expenses and settlements accept a client-generated `client_request_id`, so double clicks and retries return the original row instead of creating a duplicate. Edits pass the `updated_at` they started from, and if someone else changed the expense in the meantime the edit is rejected rather than silently overwriting.
- Deleting an expense is a soft delete. Voided payments keep their row. Every change is written to `audit_log` with before and after snapshots. Members who leave keep their history, and you can't leave while your balance is non-zero.
- Invite tokens are 192-bit random values. Only their SHA-256 hash is stored, and each link expires after 7 days and allows up to 5 uses. Re-opening a link you've already used doesn't spend a use.
- The browser only ever uses the anon key. No service-role key is needed or read anywhere.

### Smoke-testing the SQL without Supabase

`supabase/tests/` contains stubs for the Supabase-managed schemas and a script that exercises the RPCs as different users:

```bash
createdb roommate_test
psql -d roommate_test -f supabase/tests/supabase-stubs.sql
for f in supabase/migrations/*.sql; do psql -d roommate_test -f "$f"; done
psql -d roommate_test -f supabase/tests/rpc-smoke.sql        # expected rejections print as ERROR lines
psql -d roommate_test -f supabase/tests/recurring-smoke.sql  # repeats and settle day
psql -d roommate_test -f supabase/tests/settlement-confirmation-smoke.sql  # recipient confirmation
psql -d roommate_test -f supabase/tests/rate-limit-smoke.sql  # per-account rate limits
```

## Abuse and DDoS protection

The app refuses obvious floods early (per-IP rate limits and temporary blocks in `src/proxy.ts`), never turns anonymous traffic into Supabase calls, caps what one signed-in account can do in the database, and sends hardening headers. Large attacks are stopped by Vercel and Supabase, so [SECURITY.md](SECURITY.md) lists the dashboard settings to turn on and what to do during an attack.

## Project layout

```
src/lib/domain/        Pure money logic: parsing, splits, net balances, greedy settlement (+ tests)
src/lib/data/          Repository interface with demo (localStorage) and Supabase implementations
src/lib/supabase/      Browser and server Supabase clients
src/proxy.ts           Session refresh and auth redirects (only active in Supabase mode)
src/components/        App shell, dialogs, dashboard, expenses, balances, activity, and settings views
src/app/               Routes: /dashboard /expenses /balances /activity /settings /login /join/[token]
supabase/migrations/   Schema, RLS, RPCs, storage policies
```

## About the settlement algorithm

`simplifyDebts` repeatedly pairs the largest remaining debtor with the largest remaining creditor and transfers the smaller of the two amounts. Ties are broken by id, so the output is deterministic. Each step clears at least one person, so a household of n people needs at most n − 1 payments. In practice this removes most unnecessary transfers, but it is **not** guaranteed to find the true minimum number of payments, which is an NP-hard problem.

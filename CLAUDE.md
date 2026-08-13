# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Rule-based scheduling app (Next.js 14 App Router + Supabase/Postgres). Clients (the paying
users) define availability rules; visitors book appointments through a client-scoped public
link (`/visit/[clientLink]`, where the link is the client's UUID); the system prevents
double-booking via an atomic Postgres function and syncs busy blocks from Google Calendar.

Full original design doc is referenced in the README as `SCHEDULING_APP_ORCHESTRATION.md` but
that file is not present in this checkout.

## Commands

```bash
npm install
npm run dev              # http://localhost:3000
npm run build             # next build
npm run lint               # next lint
npx tsc --noEmit           # typecheck
npm test                    # vitest run (all tests)
npx vitest run lib/availability.test.ts   # single test file
npm run db:migrate         # supabase migration up
npm run db:seed             # scripts/seed.js — one test client + default reasons + a 9-5 rule
```

Requires `.env.local` (copy `.env.example`) with real Supabase, Google OAuth, Resend, and
NextAuth secrets to run end-to-end — `ALLOW_ADMIN_LOGIN=true` (+ `ADMIN_USERNAME`/
`ADMIN_PASSWORD`) unlocks a username/password login on `/dashboard` for clicking through the
UI without a Google Cloud OAuth app, but this must stay off for any real client deployment
(see `lib/auth.ts` and README "Admin login").

Migrations must be applied **in order**: `0001_init` → `0002_booking_function` →
`0003_rls` → `0004_error_log_ack` → `0005_service_role_grants` →
`0006_update_appointment_function`. `0005` looks redundant but isn't — tables created via the
Supabase SQL Editor don't inherit default `service_role` grants, which surfaces as Postgres
42501 `permission denied` errors even though RLS is correct.

## Architecture

**Two independent auth/identity systems, not one:**
- **Clients** authenticate via Google OAuth (NextAuth, JWT sessions) or, only when
  `ALLOW_ADMIN_LOGIN=true`, a rate-limited credentials provider. `lib/require-client.ts`
  resolves `clientId` from the session for every `app/api/client/*` route — always
  `instanceof NextResponse`-check its return before using it.
- **Visitors** are stateless: no login, just name + phone, scoped entirely by the
  `[clientLink]` (client UUID) in the URL. See `app/api/visitor/[clientLink]/*`.
- **Cron endpoints** (`app/api/cron/*`) use neither — they're guarded by a shared
  `x-cron-secret` header checked in `lib/require-cron.ts` via constant-time comparison
  (`lib/safe-compare.ts`), since Render's cron scheduler hits them directly, not a browser.

**Booking concurrency is handled in Postgres, not application code.** `lib/booking.ts` calls
the `book_appointment` RPC (`supabase/migrations/0002_booking_function.sql`), which uses
row-locking so simultaneous booking attempts can't double-book ("first access wins"). On a
conflict, the app falls back to `lib/availability.ts`'s pure slot calculator to suggest the
next open slot. Appointment edits go through a separate `update_appointment` function
(`0006`) using the same locking approach, since a reschedule has the same race condition as a
fresh booking; editing an appointment also clears a `red_flag` status back to `confirmed`.

**`lib/availability.ts` is a pure, DB-free function** — `getAvailableSlots()` takes rules,
booked appointments, and Google Calendar blocks as plain arguments and returns candidate slots
with an availability flag and reason (`booked`, `google_calendar_block`,
`first_n_limit_reached`, `max_per_window_reached`). Callers own fetching/scoping the inputs.
Keep it this way — it's what makes `lib/availability.test.ts` possible without a live DB.

**Rule types** (`rules` table, discriminated by `rule_type`): `available_hours` (day-specific
rule takes precedence over an "all days" rule with `day_of_week: null`), `first_n_only`
(caps bookings within a rolling window via `config.first_n`/`config.window_minutes`), and
`max_per_window` (caps concurrent bookings via `max_concurrent`/`config.window_minutes`).

**Google Calendar sync is one-way and polling-based**, not webhook-based: a cron job
(`app/api/cron/google-sync`) polls every 30 min per client's stored `google_refresh_token`
and writes conflicts into an error log with `red_flag` status (`lib/google-calendar.ts`).
There's also an on-demand "Retry Sync" action from the dashboard Errors page.

**API route conventions** (`app/api/client/*`, `app/api/visitor/*`): resolve identity first
(`requireClient()` or the `[clientLink]` param) and short-circuit on the `NextResponse` case,
validate the body with a `zod` schema from `lib/validation.ts`, use `createServiceClient()`
from `lib/supabase.ts` (service-role, bypasses RLS — RLS in `0003_rls.sql` only restricts
non-service-role access), and wrap Supabase errors with `errorResponse()`
(`lib/error-response.ts`) rather than returning raw Postgres/Supabase error text — that
leaks column/constraint names to callers, which matters especially on visitor-facing routes
where the caller is anonymous.

**Rate limiting** (`lib/rate-limit.ts`) is an in-memory sliding window — fine on Render's
single-instance Starter plan (`WEB_CONCURRENCY=1`) but resets on every deploy/restart and
won't coordinate across instances. If this scales past one instance, it needs to move to a
shared store (e.g. Upstash Redis) or the effective limit silently multiplies by instance count.

## Structure

- `app/dashboard/*` — client-facing pages (rules, reasons, schedule, errors, export), gated by
  `app/dashboard/layout.tsx`'s server-side session check
- `app/visit/[clientLink]` — 4-step visitor booking flow (reason → date/time → details →
  confirmation), including conflict "try this instead?" UI
- `app/api/client/*` / `app/api/visitor/[clientLink]/*` / `app/api/cron/*` — see auth section
  above
- `lib/` — all business logic and Supabase/Google/email integration; UI components read/write
  through the `app/api/*` routes, not `lib/` directly, except where routes themselves import it
- `supabase/migrations/*.sql` — applied in numeric order (see Commands)

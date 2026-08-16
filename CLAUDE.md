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
`0006_update_appointment_function` → `0007_client_onboarding_and_tier` →
`0008_visitor_email` → `0009_stripe_billing` → `0010_premium_grants` →
`0011_client_calendar_selection`. `0005` looks redundant but isn't — tables created via the
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
There's also an on-demand "Retry Sync" action from the dashboard Errors page. Each client can
pick which of their own Google calendars gets polled (`clients.google_calendar_id`, `0011`
migration, defaults to `'primary'`) via `app/dashboard/calendar` /
`app/api/client/calendar/route.ts`; `lib/google-calendar.ts`'s `listGoogleCalendars()` and
`getGoogleCalendarEvents(refreshToken, calendarId)` both take the calendar id explicitly now
rather than hardcoding `'primary'`. This is a core feature available to every tier, not
premium-gated. Bookings are also written back to the client's calendar: `lib/booking.ts`
(on create) and `app/api/client/appointments/[id]/route.ts` (on edit/cancel) call
`createGoogleCalendarEvent`/`updateGoogleCalendarEvent`/`deleteGoogleCalendarEvent`
best-effort, storing the resulting id in `appointments.google_event_id` (`0012` migration) so
edits/cancellations touch the same event instead of creating duplicates. A write-back failure
never fails the booking/edit/cancel itself — it's logged to `error_log` as
`google_writeback_failed`, same pattern as the confirmation-email send. `syncGoogleCalendarForClient`
excludes a client's own `google_event_id`s from its poll results so a written-back event never
red-flags the very appointment it came from. Every write to Google is tagged with an explicit
`timeZone` (from `clients.timezone`, settable on `app/dashboard/calendar` alongside the
calendar picker; defaults to `'UTC'` and is otherwise never auto-set, so a client must set it
manually) rather than converted with `.toISOString()` — appointment times are naive local
wall-clock values everywhere in this app (see `lib/date-format.ts`), so relabeling one as UTC
without a real conversion silently shifts the event on Google's side by the client's actual UTC
offset. The visitor-facing availability route and `lib/booking.ts`'s conflict-suggestion path
also live-fetch the client's Google Calendar (`getGoogleCalendarEvents`, best-effort — falls
back to no blocks on a Google outage) so a slot that's already taken on Google is never offered
in the first place, rather than only being caught after the fact by the 30-min cron's
`red_flag`. `getGoogleCalendarEvents()` strips the UTC offset Google always includes on
`event.start/end.dateTime` (`stripTimeZoneOffset()`) before returning it as a `GoogleBlock` —
`getAvailableSlots()`'s overlap check does `new Date(block.start)`, and unlike the naive DB
timestamps everywhere else in this app, a real offset in that string makes `Date` treat it as a
true absolute instant instead of resolving it against the server process's local time the same
way slot times are built. Left un-stripped, that mismatch silently un-blocks any slot that
visibly overlaps a real Google Calendar event whenever the server isn't running in that
calendar's own offset — this shipped as a live bug once, don't reintroduce it.

**Premium tier has two independent sources, and every read must account for both.**
`clients.tier` (`'free' | 'premium'`) is the column every route ultimately checks, but it can
be set two ways: the Stripe webhook (`app/api/stripe/webhook/route.ts`, the only place that
writes it for a real subscription) and the `premium_grants` table (`0010` migration) — an
admin-managed allowlist of emails that get premium access indefinitely, independent of
billing, checked live on every read rather than synced onto the column. `lib/premium-grants.ts`'s
`getEffectiveTier(dbTier, email)` combines the two and is what every authorization/display
decision must call instead of reading `tier` straight off a `clients` row. Session-based
routes get this for free — `lib/auth.ts`'s session callback already runs `getEffectiveTier()`
once per request, so anything going through `lib/require-client.ts` (branding, analytics,
reminders, dashboard nav/home) sees the combined value automatically. Anonymous/cron code
paths that query `clients.tier` directly (`lib/resolve-client-link.ts`, `lib/booking.ts`,
`app/api/visitor/[clientLink]/availability/route.ts`, `app/api/cron/sms-reminders/route.ts`,
`app/api/client/billing/route.ts`, `app/api/client/dashboard/route.ts`) call
`getEffectiveTier()` explicitly instead. `premium_grants` is managed directly via the
Supabase SQL Editor (insert/delete rows) — there's no admin UI for it.

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

- `app/dashboard/*` — client-facing pages (rules, reasons, schedule, calendar, errors,
  export, billing, branding, reminders, analytics), gated by `app/dashboard/layout.tsx`'s
  server-side session check
- `app/visit/[clientLink]` — 4-step visitor booking flow (reason → date/time → details →
  confirmation), including conflict "try this instead?" UI
- `app/api/client/*` / `app/api/visitor/[clientLink]/*` / `app/api/cron/*` — see auth section
  above
- `lib/` — all business logic and Supabase/Google/email/Stripe integration; UI components
  read/write through the `app/api/*` routes, not `lib/` directly, except where routes
  themselves import it
- `supabase/migrations/*.sql` — applied in numeric order (see Commands)

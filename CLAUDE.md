# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Rule-based scheduling app (Next.js 14 App Router + Supabase/Postgres), "Gather". Clients (the
paying users) define availability rules; visitors book appointments through a calendar-scoped
public link (`/visit/[clientLink]`, where the link is a `booking_calendars` row's UUID or a
premium-and-above custom slug); the system prevents double-booking via an atomic Postgres
function and syncs busy blocks from Google Calendar. A client owns one or more independently
configured **booking calendars** (Elite tier can have up to 5; free/premium always have exactly
1) — see "Multi-calendar architecture" below.

Full original design doc is referenced in the README as `SCHEDULING_APP_ORCHESTRATION.md` but
that file is not present in this checkout.

## Commands

```bash
npm install
npm run dev              # http://localhost:3000
npm run build             # next build
npm run lint               # next lint
npx tsc --noEmit           # typecheck
npm test                    # vitest run (all tests) — pure-function tests only, no DB
npx vitest run lib/availability.test.ts   # single test file
npm run test:integration    # real-Postgres booking-concurrency test — needs Docker + a local
                              # Supabase CLI stack; see tests/integration/booking-concurrency.test.ts
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
`0011_client_calendar_selection` → `0012_appointment_google_event` → `0013_elite_tier` →
`0014_booking_calendars` → `0015_booking_calendars_backfill` → `0016_calendar_id_fk_move` →
`0017_booking_functions_calendar_scoped` → `0018_client_collaborators`. `0013` also needs `STRIPE_ELITE_PRICE_ID` set
(alongside the existing `STRIPE_PREMIUM_PRICE_ID`) once an Elite Price exists in Stripe — see
its migration file header. `0014`-`0017` are the multi-calendar migration (see "Multi-calendar
architecture" below) — `0016` is a genuinely destructive schema change (drops `client_id` off
five tables and several columns off `clients`), so back up before applying it against a live
database with real client data. `0005` looks redundant but isn't — tables created via the
Supabase SQL Editor don't inherit default `service_role` grants, which surfaces as Postgres
42501 `permission denied` errors even though RLS is correct.

## Architecture

**Two independent auth/identity systems, not one:**
- **Clients** authenticate via Google OAuth (NextAuth, JWT sessions) or, only when
  `ALLOW_ADMIN_LOGIN=true`, a rate-limited credentials provider. `lib/require-client.ts`
  resolves `clientId` from the session for every `app/api/client/*` route — always
  `instanceof NextResponse`-check its return before using it. Every write route additionally
  resolves a `calendarId` (query param) via `lib/require-calendar.ts`'s `requireCalendarAccess()`
  — see "Multi-calendar architecture" below.
- **Visitors** are stateless: no login, just name + phone, scoped entirely by the
  `[clientLink]` (a `booking_calendars` UUID or slug) in the URL. See
  `app/api/visitor/[clientLink]/*` and `lib/resolve-calendar-link.ts`.
- **Cron endpoints** (`app/api/cron/*`) use neither — they're guarded by a shared
  `x-cron-secret` header checked in `lib/require-cron.ts` via constant-time comparison
  (`lib/safe-compare.ts`), since Render's cron scheduler hits them directly, not a browser.

**Booking concurrency is handled in Postgres, not application code.** `lib/booking.ts` calls
the `book_appointment` RPC (`supabase/migrations/0017_booking_functions_calendar_scoped.sql`,
scoped by `calendar_id`), which uses row-locking so simultaneous booking attempts can't
double-book ("first access wins"). On a conflict, the app falls back to `lib/availability.ts`'s
pure slot calculator to suggest the next open slot. Appointment edits go through a separate
`update_appointment` function (same `0017` file) using the same locking approach, since a
reschedule has the same race condition as a fresh booking; editing an appointment also clears a
`red_flag` status back to `confirmed`. **This is the highest-risk logic in the app** — if you
touch either function, re-verify with a real concurrency test (two simultaneous booking attempts
on the same slot), not just the pure-function tests, which never touch Postgres.

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
(`app/api/cron/google-sync`) polls every 30 min per booking calendar's `google_calendar_id`
(under the owning client's `google_refresh_token`) and writes conflicts into an error log with
`red_flag` status (`lib/google-calendar.ts`'s `syncGoogleCalendarForCalendar()`/
`syncAllCalendars()`). There's also an on-demand "Retry Sync" action from the dashboard Errors
page. Each calendar can pick which of the client's Google calendars gets polled
(`booking_calendars.google_calendar_id`, defaults to `'primary'`) via `app/dashboard/calendar` /
`app/api/client/calendar/route.ts` — one Google login (`clients.google_refresh_token`) can back
several booking calendars, each polling a different real Google calendar. `lib/google-calendar.ts`'s
`listGoogleCalendars()` and `getGoogleCalendarEvents(refreshToken, calendarId)` both take the
calendar id explicitly. This is a core feature available to every tier, not premium-gated.
Bookings are also written back to the calendar's Google calendar: `lib/booking.ts` (on create)
and `app/api/client/appointments/[id]/route.ts` (on edit/cancel) call
`createGoogleCalendarEvent`/`updateGoogleCalendarEvent`/`deleteGoogleCalendarEvent`
best-effort, storing the resulting id in `appointments.google_event_id` (`0012` migration) so
edits/cancellations touch the same event instead of creating duplicates. A write-back failure
never fails the booking/edit/cancel itself — it's logged to `error_log` as
`google_writeback_failed`, same pattern as the confirmation-email send.
`syncGoogleCalendarForCalendar` excludes a calendar's own `google_event_id`s from its poll
results so a written-back event never red-flags the very appointment it came from. Every write
to Google is tagged with an explicit `timeZone` (from `booking_calendars.timezone`, settable on
`app/dashboard/calendar` alongside the calendar picker; defaults to `'UTC'` and is otherwise
never auto-set, so a client must set it per-calendar manually) rather than converted with
`.toISOString()` — appointment times are naive local wall-clock values everywhere in this app
(see `lib/date-format.ts`), so relabeling one as UTC without a real conversion silently shifts
the event on Google's side by the calendar's actual UTC offset. The visitor-facing availability
route and `lib/booking.ts`'s conflict-suggestion path also live-fetch the calendar's Google
Calendar (`getGoogleCalendarEvents`, best-effort — falls back to no blocks on a Google outage)
so a slot that's already taken on Google is never offered in the first place, rather than only
being caught after the fact by the 30-min cron's `red_flag`. `getGoogleCalendarEvents()` strips
the UTC offset Google always includes on `event.start/end.dateTime` (`stripTimeZoneOffset()`)
before returning it as a `GoogleBlock` — `getAvailableSlots()`'s overlap check does
`new Date(block.start)`, and unlike the naive DB timestamps everywhere else in this app, a real
offset in that string makes `Date` treat it as a true absolute instant instead of resolving it
against the server process's local time the same way slot times are built. Left un-stripped,
that mismatch silently un-blocks any slot that visibly overlaps a real Google Calendar event
whenever the server isn't running in that calendar's own offset — this shipped as a live bug
once, don't reintroduce it.

## Multi-calendar architecture

A `clients` row is login/billing identity only — email, Google OAuth tokens, `tier`,
`sms_reminders_enabled`, `tutorial_completed_at`. Everything a visitor actually books against
(rules, reasons, appointments, error log, CSV exports) belongs to a **`booking_calendars`**
row instead, which also owns branding (`display_name`/`accent_color`/`logo_url`/`slug`), the
Google Calendar selection (`google_calendar_id`), and `timezone`. A client can own several
calendars — free/premium are capped at 1 (created automatically: `lib/auth.ts`'s `signIn`
callback creates one, same id as the client, on a brand-new signup; `0015`'s migration
backfilled one for every pre-existing client the same way, which is also why an old client's
`/visit/[uuid]` link kept resolving unchanged after the migration), Elite up to 5
(`app/api/client/calendars/route.ts` enforces the cap; `CALENDAR_LIMIT_BY_TIER` there is the
single place the 1-vs-5 limit is defined).

- **Every `app/api/client/*` route that touches a calendar-scoped table takes a `calendarId`
  query param** (never a body field — kept separate from each resource's own zod schema on
  purpose), resolved via `lib/require-calendar.ts`'s `requireCalendarAccess(calendarId,
  clientId)`, which 404s if the calendar isn't the caller's own. This is the substitute for RLS
  the same way `requireClient()` already was — the service-role client bypasses RLS entirely.
- **`lib/resolve-calendar-link.ts`** (replaces the old `lib/resolve-client-link.ts`) resolves a
  visitor's `[clientLink]` URL param to a `{ calendarId, clientId }` pair — UUID always
  resolves, a slug only resolves while the *owning client's* effective tier is premium-or-above.
- **Dashboard "currently selected calendar" state** lives in `components/CalendarContext.tsx`
  (`CalendarProvider`/`useCalendar()`), mounted by `components/DashboardChrome.tsx` so every
  dashboard page can read it. Persisted in a `gather_calendar_id` cookie, read server-side once
  in `app/dashboard/layout.tsx` (via `cookies()`) to avoid a flash-of-wrong-calendar on a hard
  reload, then owned client-side for the rest of the session — corrected automatically if the
  cookie references a calendar the caller no longer has (deleted, or a different account's
  cookie on a shared browser). Every dashboard page threads `?calendarId=` into its own SWR key/
  fetch calls exactly like `app/dashboard/schedule/page.tsx` already threaded `reasonId`/
  `startDate` before multi-calendar existed — that page is the pattern this one generalizes.
  The switcher itself (a `<select>` in `components/DashboardNav.tsx`'s header) only renders once
  a client actually has more than one calendar, so free/premium clients never see it.
- **`app/dashboard/calendars`** (`app/api/client/calendars/*`) is the Elite-gated "Manage
  calendars" page — create/rename/delete, cap enforcement, at-least-one-calendar-always
  guaranteed (deleting a client's last calendar is blocked).
- **What stayed client-level, not per-calendar** (deliberate, not oversight): `tier`/billing
  (`app/api/client/billing/*`), `sms_reminders_enabled` (`app/api/client/reminders/route.ts` —
  split out from the old branding route once branding itself moved to `booking_calendars`), and
  `google_refresh_token` (one Google login backs every calendar under an account).
- **Naming collision to watch for**: `booking_calendars.google_calendar_id` is GOOGLE's own
  calendar id string (an email address or opaque `xxxx@group.calendar.google.com`), unrelated to
  `booking_calendars.id` (the booking-calendar-scoping `calendarId` every route above takes).
  `lib/validation.ts`'s `calendarSelectSchema` deliberately names its field `googleCalendarId`,
  not `calendarId`, to keep this distinction visible in code.

## Team access (Elite tier)

A client can invite other emails to help manage one of their calendars without sharing their
own Google login (`client_collaborators`, `0018` migration). Access is scoped per-**calendar**,
not per-account — the same email can be an Editor on one calendar and have no access at all to
another, even under the same owner, via `UNIQUE(calendar_id, email)`.

- **A collaborator can have no `clients` row of their own at all.** `lib/require-client.ts`'s
  `clientId` is nullable for exactly this reason — `lib/auth.ts`'s `signIn` callback checks
  `client_collaborators` for the signing-in email *before* creating a new owner account, so a
  pure collaborator never gets an orphaned second account. `session()` resolves
  `collaboratorCalendars: [{calendarId, clientId (the owner's), calendarDisplayName, role}]`
  separately from the owner `clientId`, since one person can be both (their own calendars, plus
  calendars they collaborate on elsewhere) — the switcher's "Your calendars" / "Shared with you"
  grouping is this same data. An invite's `accepted_at` is stamped automatically on the
  invitee's first matching sign-in (no separate "accept" click) — see the `signIn` callback's
  comments for exactly where.
- **`lib/require-calendar.ts`'s `requireCalendarAccess()`** checks ownership OR collaboration
  and returns the resolved `role` (`'owner' | 'editor' | 'viewer'`). Every write route calls
  `requireWriteRole(role)` afterward (`'viewer'` can never write); calendar create/delete,
  billing, and team management additionally call `requireOwnerRole(role)` — an Editor can
  manage bookings but never those.
- **Premium/Elite-gated calendar-scoped features must check the CALENDAR's owning client's
  tier, never the requester's own** — `lib/require-calendar.ts`'s `calendarOwnerTier()`. An
  Editor with no subscription of their own, collaborating on an Elite owner's calendar, must
  still get full access to that calendar's premium features (branding, analytics); gating on
  the collaborator's own (often `'free'`) tier was a real bug caught while building this
  (`app/api/client/branding/route.ts`, `app/api/client/analytics/route.ts`,
  `app/api/client/dashboard/route.ts` all resolve tier this way now). The same class of bug
  applies to `google_refresh_token` — always resolved through the calendar's actual owner (a
  join), never `client.clientId` directly (`app/api/client/calendar/route.ts`,
  `lib/booking.ts`, `lib/google-calendar.ts`) — a collaborator has no refresh token of their own.
- **Owner-only routes** (billing, `app/api/client/calendars/*`, `app/api/client/reminders/*`,
  `app/api/client/onboarding/complete`) explicitly reject a `null` `clientId` rather than let a
  collaborator's request silently query with a null id.
- **`components/CollaboratorBanner.tsx`** shows "Shared with you — {role} access on {calendar}"
  whenever the *currently selected* calendar's role isn't `'owner'` — reflects the switcher's
  live selection, not a fixed account-wide fact, since an owner can switch into a calendar they
  merely collaborate on. A pure-collaborator session also skips the first-run onboarding tour
  (`components/DashboardChrome.tsx`) since there's no `tutorial_completed_at` state to persist
  for an account that doesn't exist.
- **Invite email** (`lib/email.ts`'s `sendCollaboratorInviteEmail`) is best-effort, same pattern
  as every other email send in this codebase — a failed send logs to `error_log` as
  `collaborator_invite_email_failed` and never rolls back the already-created invite row.

**Tier is three-valued and ranked, not a boolean, and has two independent sources per read.**
`clients.tier` (`'free' | 'premium' | 'elite'`, widened from two values by the `0013` migration
— `elite` is $99/mo, unlocking multiple booking calendars and shared per-calendar dashboard
access; see `gather-elite-proposal.md`) is the column every route ultimately checks, but it can
be set two ways: the Stripe webhook (`app/api/stripe/webhook/route.ts`, the only place that
writes it for a real subscription — it derives tier from *which Stripe Price* the subscription's
line item is on, via `STRIPE_PREMIUM_PRICE_ID`/`STRIPE_ELITE_PRICE_ID`, not just active/trialing
status, since two paid tiers can both be "active") and the `premium_grants` table (`0010`
migration) — an admin-managed allowlist of emails that get **premium** access indefinitely
(grants never reach `elite`), independent of billing, checked live on every read rather than
synced onto the column. `lib/premium-grants.ts`'s `getEffectiveTier(dbTier, email)` combines the
two and is what every authorization/display decision must call instead of reading `tier`
straight off a `clients` row. Because there are now three ranked tiers, a gate for "premium or
better" must use `lib/tier.ts`'s `isAtLeast(tier, 'premium')` rather than `tier === 'premium'` —
the latter would wrongly exclude Elite clients from every premium feature (branding, custom
slug, analytics, reminders, confirmation emails). An Elite-exclusive feature checks
`tier === 'elite'` directly instead. Session-based routes get the grants-combination for free —
`lib/auth.ts`'s session callback already runs `getEffectiveTier()` once per request, so anything
going through `lib/require-client.ts` (branding, analytics, reminders, dashboard nav/home) sees
the combined value automatically. Anonymous/cron code paths that query `clients.tier` directly
(`lib/resolve-calendar-link.ts`, `lib/booking.ts`, `app/api/visitor/[clientLink]/availability/route.ts`,
`app/api/cron/sms-reminders/route.ts`, `app/api/client/billing/route.ts`,
`app/api/client/dashboard/route.ts`) call `getEffectiveTier()` explicitly instead.
`premium_grants` is managed directly via the Supabase SQL Editor (insert/delete rows) — there's
no admin UI for it.

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

- `app/dashboard/*` — client-facing pages (rules, reasons, schedule, calendar, errors, export,
  billing, branding, reminders, analytics, calendars, team — branding/reminders/analytics are
  premium+, calendars/team are Elite-only), gated by `app/dashboard/layout.tsx`'s server-side
  session check. Every page except billing/reminders/calendars/team reads the
  currently-selected calendar from `useCalendar()` (`components/CalendarContext.tsx`), which
  also exposes the caller's `role` on it for viewer-role UI gating — see "Multi-calendar
  architecture" and "Team access" above.
- `app/visit/[clientLink]` — 4-step visitor booking flow (reason → date/time → details →
  confirmation), including conflict "try this instead?" UI; `[clientLink]` resolves to a
  `booking_calendars` row via `lib/resolve-calendar-link.ts`, despite the param's name (kept for
  route-path/URL-scheme continuity with pre-multi-calendar links).
- `app/api/client/*` / `app/api/visitor/[clientLink]/*` / `app/api/cron/*` — see auth section
  above. `app/api/client/calendars/*` is calendar *management* (create/rename/delete a
  `booking_calendars` row); every other calendar-scoped route takes an existing calendar's id
  as a `?calendarId=` param instead.
- `lib/` — all business logic and Supabase/Google/email/Stripe integration; UI components
  read/write through the `app/api/*` routes, not `lib/` directly, except where routes
  themselves import it
- `supabase/migrations/*.sql` — applied in numeric order (see Commands)

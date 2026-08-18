# Scheduling App

Rule-based scheduling app. Clients set availability rules; visitors book via a client-scoped
link; the system prevents double-booking and syncs with Google Calendar.

Full design lives in `SCHEDULING_APP_ORCHESTRATION.md` in the project root.

**Status:** Phase 3 (Frontend) implemented. The client dashboard (home, rules, reasons,
schedule calendar, error log, export) and the 4-step visitor booking flow are real, wired-up
UI — not placeholders. `npm install`, `npx tsc --noEmit`, `npm test`, and `npm run build` all
pass as of this commit.

## Approved Architecture (Phase 1, revised)

- **Frontend + API:** Next.js 14 (App Router), Tailwind CSS
- **Database/Auth:** Supabase (PostgreSQL)
- **Hosting:** Render (Starter instance, $7/mo — always-on, avoids Vercel's free-tier
  non-commercial-use restriction and Render's own free-tier 15-min spin-down)
- **Email (CSV export):** Resend (free tier: 3,000 emails/mo, well above the ~1/mo need).
  Replaces SendGrid, which discontinued its free tier in May 2025.
- **Client auth:** Google OAuth (NextAuth.js)
- **Visitor auth:** Stateless name + phone, link-scoped
- **Google Calendar sync:** Polling every 30 min via cron

### Cost

| Item | Launch (1 client) | Scale (100+ clients) |
|---|---|---|
| Render | $7/mo (Starter) | $25/mo (Standard) |
| Supabase | Free (500MB) | $25/mo (Pro) |
| Resend | Free (3K emails/mo) | ~$20/mo |
| **Total** | **~$7/mo** | **~$70/mo** |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase, Google OAuth, Resend, NextAuth secrets
npm run db:migrate            # apply supabase/migrations/0001-0007 in order (see below)
npm run db:seed               # optional: seed one test client + default reasons + a 9-5 rule
npm run dev                   # http://localhost:3000
npm test                      # runs the availability-calculator unit tests (vitest)
```

If you're running migrations by hand in the Supabase SQL Editor rather than via
`db:migrate`/the Supabase CLI, run all seven files in order: `0001_init.sql`,
`0002_booking_function.sql`, `0003_rls.sql`, `0004_error_log_ack.sql`,
`0005_service_role_grants.sql`, `0006_update_appointment_function.sql`,
`0007_client_onboarding_and_tier.sql`. **0005 matters even
though it looks redundant** — tables created through the SQL Editor don't always inherit the
default grants Supabase normally sets up for `service_role` automatically, which shows up as
`permission denied for table X` (Postgres error 42501) the first time the app queries
anything, even though RLS (0003) is correct and `service_role` bypasses RLS by default.
Running 0005 fixes it for every table, and (via `ALTER DEFAULT PRIVILEGES`) for functions
created afterward too — so 0006's `update_appointment` function doesn't need its own grant.

Real Google OAuth credentials, a Supabase project, and a Resend API key are required for the
app to actually run end-to-end — this sandbox verified the code compiles, typechecks, and the
core booking/availability logic is correct, but couldn't exercise it against a live database,
Google Calendar, or real sign-in flow.

## Admin login (testing only — do not use for a real client)

To click through the dashboard before a real Google Cloud OAuth app exists, set
`ALLOW_ADMIN_LOGIN=true` (plus `ADMIN_USERNAME` / `ADMIN_PASSWORD`, default `admin` /
`admin1`) in `.env.local`. A username/password box then appears on the sign-in screen below
the Google button. This still requires a real Supabase project — the admin account is just a
`clients` row with no `google_refresh_token`, so every dashboard page works except Google
Calendar sync (nothing to sync without a linked calendar).

**This is not secure** — a fixed, low-entropy password with no rate limiting or lockout.
Leave `ALLOW_ADMIN_LOGIN` unset (or `false`) the moment a real client is using this
deployment; the provider is compiled out entirely when it's not `"true"` (see `lib/auth.ts`).

## Frontend structure (Phase 3)

- `app/page.tsx` — single-page home/landing page (hero, feature highlights, client sign-in CTA)
- `app/dashboard/layout.tsx` — server-side session check (`getServerSession`); shows a
  Google sign-in prompt if unauthenticated, otherwise renders `DashboardNav` + the page
- `app/dashboard/page.tsx` — stats (this month / next booked / pending errors), quick
  actions, upcoming-7-days list
- `app/dashboard/rules/page.tsx` — list + a `RuleEditor` modal (react-hook-form + zod) for
  available_hours / max_per_window / first_n_only, with Edit and Delete (with an inline
  confirm) on each rule
- `app/dashboard/reasons/page.tsx` — list with inline duration edit and ↑/↓ reordering, plus
  an add form
- `app/dashboard/schedule/page.tsx` — month `Calendar` (green/red dots for
  confirmed/red-flag counts) + a day detail panel of `AppointmentCard`s with Edit (opens an
  `AppointmentEditor` modal — name/phone/reason/time/notes, conflict-checked) and Delete
  (inline confirm)
- `app/dashboard/errors/page.tsx` — error log, 5-min auto-refresh (SWR `refreshInterval`),
  Acknowledge + Retry Sync actions
- `app/dashboard/export/page.tsx` — month picker, triggers `/api/client/export`
- `app/visit/[clientLink]/page.tsx` — 4-step visitor flow (reason → date/time → details →
  confirmation), including the booking-conflict "try this instead?" accept/decline UI
- `components/*` — the reusable set from the Phase 3 spec (Button, Input, Select, Modal,
  Calendar, TimeSlotGrid, AppointmentCard, RuleEditor, ErrorBanner), plus
  `AppointmentEditor` and SignInButton/SignOutButton/DashboardNav/AdminLoginForm
- Responsive: `DashboardNav` collapses to a horizontal scroll bar on mobile, becomes a left
  sidebar at `md:`; forms and grids use Tailwind's `sm:`/`md:`/`lg:` breakpoints throughout

**Added beyond the original Phase 3 spec:**
- `error_log.acknowledged` column (`0004_error_log_ack.sql`),
  `POST /api/client/errors/[id]/acknowledge`, and `POST /api/client/errors/retry-sync`
  (re-runs that client's Google Calendar sync on demand) — needed to make the Error Log
  page's Acknowledge/Retry actions real.
- `PATCH`/`DELETE /api/client/rules/[id]` and `PATCH`/`DELETE /api/client/appointments/[id]`
  — rule and appointment editing/deletion weren't in the original Phase 3 spec but were
  requested afterward. Appointment edits go through a new `update_appointment` Postgres
  function (`0006_update_appointment_function.sql`) that reuses `book_appointment`'s
  row-locking approach so a reschedule can't silently create a double-booking; editing an
  appointment also clears a `red_flag` status back to `confirmed` (editing is how a client
  resolves a Google Calendar conflict — move it, or just re-save it once the block is gone).
  Deleting a rule or appointment is a plain scoped `DELETE`, since there's no concurrency
  concern on a delete the way there is on a competing insert.

The visitor link is still the client's UUID (noted in the Phase 2 section) — drag-to-reorder
on the Reasons page is implemented as ↑/↓ buttons instead of a drag library, to avoid adding
a whole DnD dependency for four list items.

## Structure

- `app/dashboard/*` — client-facing pages (rules, reasons, schedule, errors, export)
- `app/visit/[clientLink]` — visitor booking flow
- `app/api/client/*` — authenticated client API routes
- `app/api/visitor/[clientLink]/*` — link-scoped visitor API routes
- `app/api/cron/*` — internal jobs (Google sync, cleanup, monthly export) — guarded by
  `CRON_SECRET` via `lib/require-cron.ts`
- `lib/supabase.ts`, `lib/email.ts` — service clients
- `lib/availability.ts` — pure, unit-tested slot calculator (rules + bookings + Google blocks → slots)
- `lib/booking.ts` — calls the `book_appointment` Postgres function; falls back to the
  availability calculator to suggest a next slot on conflict
- `lib/google-calendar.ts` — refresh-token → Calendar API polling sync, red-flags conflicts
- `lib/csv-export.ts` — monthly CSV generation + email via Resend
- `lib/auth.ts` — NextAuth Google OAuth config (calendar scopes, refresh_token persistence)
- `supabase/migrations/0001_init.sql` — initial schema
- `supabase/migrations/0002_booking_function.sql` — atomic booking function (row-lock based,
  "first access wins")
- `supabase/migrations/0003_rls.sql` — enables RLS on all tables (service role only)
- `supabase/migrations/0004_error_log_ack.sql` — adds `error_log.acknowledged`
- `supabase/migrations/0005_service_role_grants.sql` — fixes a common Supabase SQL-Editor
  gotcha where `service_role` has no table grants until explicitly granted (see "Getting
  started" above)
- `supabase/migrations/0006_update_appointment_function.sql` — conflict-checked appointment
  edit function, same locking approach as `book_appointment`
- `supabase/migrations/0007_client_onboarding_and_tier.sql` — adds `tutorial_completed_at`,
  `tier` (`free`/`premium`), `display_name`, `accent_color`, `logo_url`, `slug` (+ unique
  index), and `sms_reminders_enabled` to `clients` — see "Premium tier" below
- `scripts/seed.js` — seeds one test client + default reasons + a 9-5 rule

## Onboarding tutorial

A server-persisted (not localStorage) first-run tour, gated on `clients.tutorial_completed_at`
being `NULL` — shows regardless of whether rules/reasons already exist, so it also covers a
client whose data was set up via the API/seed script before ever opening the dashboard UI.
`POST /api/client/onboarding/complete` marks it seen; the `?` icon next to the "Gather"
wordmark in `DashboardNav` replays it on demand without touching that column again.

## Premium tier (feature-flag only — no billing)

`clients.tier` is `free` or `premium`, set directly in the DB (no payment processing this
pass). Every premium-gated route checks it server-side via `requireClient()`
(`lib/require-client.ts`, which reads it from the NextAuth session — itself refreshed from the
`clients` row on every request, see `lib/auth.ts`), never from client-supplied input.

- **Branding + custom slug** (`/dashboard/branding`, `PATCH`/`GET /api/client/branding`,
  `GET /api/client/slug-available`) — display name, accent color, logo URL, and a short
  `/visit/<slug>` link as an alternative to the raw client UUID. `lib/resolve-client-link.ts`
  is the single place that resolves a `[clientLink]` URL param to a client id (UUID always
  works; a slug only resolves while that client's tier is currently `premium`) — every visitor
  route and the visitor page itself go through it.
- **Analytics** (`/dashboard/analytics`, `GET /api/client/analytics`) — booking volume by
  week, busiest days/hours, appointment status breakdown, and reason popularity over a rolling
  180-day window, aggregated server-side.

Nothing in the product claims to send SMS. `app/api/cron/sms-reminders/route.ts` and
`lib/sms.ts` exist in the codebase but aren't wired to a real provider —
`lib/sms.ts`'s `sendSms()` always throws by design (see its header comment) — and are not
scheduled as a Render cron job or surfaced anywhere in the UI.

## Local development with Docker (optional)

`docker-compose.yml` and `Dockerfile` run this app in a container for local dev/testing
parity. This project talks to Supabase via its client SDK, not a raw Postgres connection, so
there's no bundled database container — point `.env.local` at a real (free-tier) hosted
Supabase project, or run `supabase start` (Supabase CLI) for a fully offline local stack, then:

```bash
docker compose up --build
# Access: http://localhost:3000
```

This isn't the path used to deploy to Render below (Render builds from source with its native
Node buildpack) — it's here for anyone who wants to test the container build itself, or as an
option if Render is later pointed at the Dockerfile instead.

## Deploying to Render

1. Push this repo to GitHub.
2. Render dashboard → New → Web Service → connect repo.
3. Build command: `npm install && npm run build`. Start command: `npm start`.
4. Instance type: Starter ($7/mo) for always-on (free tier spins down after 15 min idle).
5. Add environment variables from `.env.example` in the Render dashboard.
6. Add Render **Cron Jobs** (a different resource type from the Web Service), each guarded by
   the `x-cron-secret` header `lib/require-cron.ts` checks for:
   ```bash
   # every 30 min
   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://yourapp.onrender.com/api/cron/google-sync
   # daily
   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://yourapp.onrender.com/api/cron/cleanup
   # 1st of the month
   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://yourapp.onrender.com/api/cron/export-monthly
   ```

   `sms-reminders` exists in the codebase but is not scheduled — see "Premium tier" above for why.

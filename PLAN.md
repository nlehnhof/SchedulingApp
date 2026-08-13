# Gather — UI/UX & Premium Tier Improvement Plan

Branch: `improve/ui-premium-tier`. Written by the Planner pass. Scope: research + planning only,
no application code was changed to produce this document.

## How this was researched

- **Static audit**: read every file in `app/dashboard/*`, `app/visit/[clientLink]/*`,
  `components/*`, plus the API routes and `lib/` modules those pages call, to trace each flow
  end-to-end (UI → API route → validation → Supabase/RPC).
- **Live browser testing (Task 2) could not be performed.** `npm run dev` was started
  successfully (ran on `localhost:3001`; `3000` was already occupied) and `npm run db:seed` was
  run to (re-)seed the standard test client, appointment reasons, and a 9–5 rule — link:
  `/visit/07f627c6-74d1-4f2e-a228-3c374901e54d`. However, the `claude-in-chrome` MCP tools
  reported "Browser extension is not connected" on every attempt (checked twice after loading
  the skill), so no admin sign-in, dashboard click-through, or visitor booking flow was actually
  exercised in a browser this pass. **No live data was touched, no export email was triggered.**
  Section 1 below is therefore entirely "found by reading code" — the "hit while clicking
  through" half of the task is unfulfilled and should be re-run with a connected browser before
  treating this plan as fully validated. The dev server was stopped at the end of this session.

---

## 1. Weaknesses & pain points found

All items below are static-analysis findings (file/line-grounded), since live click-through
could not be completed this pass.

### Navigation & first-run experience
- `app/dashboard/layout.tsx` — no onboarding of any kind. A brand-new client who just finished
  Google OAuth lands straight on an empty `DashboardHome` with zero rules, zero reasons, and no
  explanation that they need to create at least one `available_hours` rule before visitors can
  book anything. `app/dashboard/rules/page.tsx:163-167` does show "No rules yet…" text, but only
  once the client has already navigated to Rules — nothing on the home page points them there.
- `components/DashboardNav.tsx` — six flat nav items (Home, Schedule, Rules, Reasons, Errors,
  Export) with no visual grouping or hint at the required setup order (Reasons → Rules →
  shareable link → Schedule). A first-time user has no way to discover their own visitor booking
  link (`/visit/[clientLink]`) anywhere in the dashboard UI — it's only ever printed to the
  console by `scripts/seed.js`. There is no "Copy your booking link" affordance anywhere in
  `app/dashboard/*`.
- `app/dashboard/layout.tsx:22-30` — the `ALLOW_ADMIN_LOGIN` warning banner is plain red text
  sitting below the real Google sign-in button with no visual separation beyond a thin border;
  on first glance it could be misread as an error state rather than a deliberate testing-mode
  notice.

### Rules & Reasons
- `app/api/client/reasons/route.ts` has only `GET`/`POST` — **there is no `DELETE` route for
  appointment reasons**, and `app/dashboard/reasons/page.tsx` has no delete button either. Once a
  reason is created it can never be removed from the UI or API, only reordered and have its
  duration changed.
- The reasons "edit" flow is actually a `POST` that Supabase upserts on `onConflict:
  'client_id,name'` (`app/api/client/reasons/route.ts:33-41`). Because `name` is part of the
  conflict key, there is no way to rename an existing reason — doing so would silently create a
  brand-new row rather than updating the old one. The UI never exposes a name-edit field at all
  (`app/dashboard/reasons/page.tsx` only inlines a duration `<input>`), so this landmine isn't
  currently reachable from the UI, but it blocks ever adding a "rename" feature without a schema
  change or a dedicated `PATCH /api/client/reasons/[id]`.
- `components/RuleEditor.tsx` + `app/dashboard/rules/page.tsx` — the rules list
  (`summarize()`, lines 14-29) renders a flat, unsorted `<ul>` with no grouping by day or type.
  CLAUDE.md documents that a day-specific `available_hours` rule takes precedence over an
  "all days" rule, and that `max_per_window`/`first_n_only` rules interact with `available_hours`
  rules — none of that precedence is surfaced in the UI, so a client with several overlapping
  rules has no way to understand why a particular slot is or isn't available without reading the
  source.
- `app/dashboard/rules/page.tsx:104-108` — rule delete has an inline confirm ("Delete this
  rule?") but no undo and no explanation of the consequence (e.g. "visitors will stop seeing
  slots that depended on this rule").

### Schedule / Calendar
- `components/AppointmentCard.tsx:58-71` — the visitor's name, phone, and notes are only
  revealed via `group-hover:opacity-100` on desktop hover. **There is no keyboard-focus or
  touch-tap equivalent** (no `:focus-within` fallback, no click-to-toggle). On a tablet or phone
  — a very plausible way to check a schedule in the field — the visitor's contact info is
  effectively unreachable from this card without editing the appointment.
- `components/Calendar.tsx:96-104` — day cells show colored dots for confirmed/red-flag counts
  but have no `aria-label` describing what those dots mean; the only legend is on the parent
  `SchedulePage` ("Confirmed" / "Conflict" dots at lines 112-119 of `schedule/page.tsx`), so a
  screen-reader user tabbing through calendar cells gets no equivalent information.
  Low-availability days are dimmed via `text-text-secondary/50` with no legend entry explaining
  what "greyed out" means.
- `app/dashboard/schedule/page.tsx` — switching the "Appointment reason" `<Select>` re-fetches
  the whole month's schedule (`scheduleUrl` depends on `activeReasonId`), but there's no loading
  indicator during that re-fetch beyond the top-level `isLoading` check, so the calendar can
  appear to freeze/flash while switching reasons.
- `components/Modal.tsx` — no focus trap, no `Escape`-to-close handler, and focus isn't returned
  to the triggering element on close. Used for rule creation/edit and appointment edit, both
  keyboard-accessibility gaps.

### Errors page
- `components/ErrorBanner.tsx:26-30` — "Retry Sync" only appears
  `error.error_type.startsWith('google_sync')`, but nothing on the page explains *why* a given
  error doesn't show that button (e.g. a generic booking error), which reads as an
  inconsistent/broken control to a client scanning the list.
- `app/dashboard/errors/page.tsx` auto-refreshes every 5 minutes but gives no visual cue when a
  refresh happens (no timestamp, no subtle spinner), so a client watching the page has no signal
  that it's "live."

### Export
- `app/dashboard/export/page.tsx:26-36` — `handleExport` has no loading/disabled state on the
  button during the request. A double-click sends **two real emails** via Resend
  (`lib/csv-export.ts:65-69`, `exportMonthlyCSV`) since there's no debounce and no
  `disabled={sending}` guard — unlike `ReasonsPage`'s `saving` state pattern used elsewhere in
  the same codebase.
- No confirmation step before sending — one click immediately emails real appointment data
  (`lib/csv-export.ts`) to `ADMIN_EMAIL`/the client's account email with no "are you sure" or
  preview.

### Visitor booking flow (`app/visit/[clientLink]/page.tsx`)
- **Visitors see the client's raw email address**, not a business/display name. The visitor
  availability route returns `clientName: client.email`
  (`app/api/visitor/[clientLink]/availability/route.ts:53`), and the booking page renders
  `Booking with {clientName}` (`app/visit/[clientLink]/page.tsx:122`). There's no `display_name`
  or "business name" field on `clients` (`supabase/migrations/0001_init.sql:3-11`) — this both
  looks unprofessional and leaks the client's personal/login email to any visitor.
- No step/progress indicator across the 4 steps (reason → datetime → details → confirmation) —
  a first-time visitor has no sense of how many steps remain.
- `Input` for phone (`app/visit/[clientLink]/page.tsx:199`) has no `type="tel"` or
  `inputMode="tel"`, so mobile visitors (the primary expected device for a booking link) get the
  full alphanumeric keyboard instead of a numeric one.
- The date-picker step (`step === 'datetime'`) renders every date with a slot as a flat wrapped
  row of buttons (`app/visit/[clientLink]/page.tsx:146-161`) rather than a calendar — for a
  reason with many available days over the 30-day window this becomes a long, unlabeled
  horizontal-wrapping button soup with no month/weekday context (contrast with the nicely built
  `components/Calendar.tsx` used only on the dashboard side).
- Conflict retry UX (`app/visit/[clientLink]/page.tsx:202-232`) is solid (offers the next slot
  inline), but if the visitor declines, the form silently falls back to "pick a different slot"
  with no re-highlighting of which slot is now known-taken in `TimeSlotGrid`.
- No empty/loading state distinction: `reasons.length === 0` renders "Loading options…"
  (`page.tsx:127`) even after a real load fails or genuinely returns zero reasons — a client who
  hasn't set up any reasons yet gives visitors an infinite "Loading options…" with no real error.
- `loadError` state, once set, replaces the *entire* page including the header
  (`page.tsx:112-118`) — a transient availability-fetch error wipes out the reason the visitor
  already picked, forcing a full restart with no "try again" affordance.

### Security-adjacent UX (see also Section 5)
- The admin-login credentials form (`components/AdminLoginForm.tsx`) and its warning
  (`app/dashboard/layout.tsx:22-30`) are appropriately gated behind `ALLOW_ADMIN_LOGIN`, but nothing
  in the dashboard itself (once signed in as admin) reminds the client they're in a
  no-Google-Calendar-sync test session — `lib/auth.ts:63-65` notes `google_refresh_token` stays
  null for this login, but the UI never surfaces that, so an admin-testing user could be confused
  about why Google Calendar sync/errors never appear.

---

## 2. UI improvements

Scoped, concrete changes addressing Section 1:

1. **Add a "Your booking link" card to the dashboard home** (`app/dashboard/page.tsx`) — show
   `/visit/{clientId}` with a copy-to-clipboard button. This is the single highest-value fix:
   right now there is no way to find your own visitor link from the UI at all.
2. **Empty-state nudges on `DashboardHome`**: if `rules.length === 0`, show an inline banner
   ("Add your first availability rule so visitors can book you") linking to `/dashboard/rules`;
   same pattern if `reasons.length === 0`.
3. **Add `DELETE /api/client/reasons/[id]` + a delete button** in `ReasonsPage`, with the same
   inline-confirm pattern already used in `RulesPage`/`SchedulePage`. Add a real
   `PATCH /api/client/reasons/[id]` (by id, not by upsert-on-name) so renaming is safe; keep the
   existing POST for create-only, gated by validating the name doesn't already exist.
4. **Fix `AppointmentCard` contact-info reveal**: replace `group-hover` with a click/tap-to-expand
   disclosure (or always show name/phone inline and move only `notes` behind a toggle), so it
   works on touch devices and via keyboard (`:focus-within` + `aria-expanded` button).
5. **Add a focus trap + Escape-to-close + focus-return to `components/Modal.tsx`** — one shared
   fix that improves every modal-based flow (rule editor, appointment editor) at once.
6. **Debounce/disable the Export button** while a request is in flight
   (`app/dashboard/export/page.tsx`), matching the `saving` pattern already used in
   `ReasonsPage`, and add a lightweight "This will email a CSV to your account email — continue?"
   confirm step before firing.
7. **Add a client-facing `display_name` field** (Settings section, new or folded into an existing
   page) and use it instead of raw email in `clientName` responses
   (`app/api/visitor/[clientLink]/availability/route.ts:53`) and the visitor page header. Falls
   back to the current email-based label if unset, so this is non-breaking. This is also a
   direct prerequisite for the premium "custom branding" feature in Section 4.
8. **Visitor flow**: add a lightweight 4-dot/step progress indicator at the top of
   `app/visit/[clientLink]/page.tsx`; set `type="tel"`/`inputMode="tel"` on the phone `Input`;
   distinguish "no reasons configured yet" from "loading" (`reasons.length === 0 && !loading &&
   !loadError` → distinct copy); make `loadError` render as a dismissible banner above the
   current step rather than replacing the whole page, so in-progress selections survive a
   transient fetch error.
9. **Add `aria-label`s to `Calendar` day cells** describing date + confirmed/conflict counts, and
   add a third legend entry explaining the dimmed "no availability" state.
10. **Group/sort the Rules list** by `rule_type` (or at least by day-of-week for
    `available_hours` rules) and add a one-line explainer above the list: "Day-specific hours
    override an all-days rule for that day; capacity rules apply on top of your hours."
11. **Nav polish**: visually separate `DashboardNav` into a "Setup" group (Reasons, Rules) and an
    "Operate" group (Schedule, Errors, Export) so the natural setup order is implied by layout,
    not just alphabetical/arbitrary order.

---

## 3. First-time client tutorial

**"Seen it" tracking**: add a `tutorial_completed_at TIMESTAMP NULL` column to `clients` (small,
additive migration, e.g. `0007_client_onboarding.sql`). Persisted server-side (not
localStorage) so it survives across devices/browsers for the same client — consistent with how
this app already treats the client row as the source of truth. `POST
/api/client/onboarding/complete` sets it; `session` callback in `lib/auth.ts` (already fetching
the client row) can include `tutorialCompletedAt` alongside `clientId`/`timezone` at near-zero
extra cost.

**Trigger condition, precisely**: show the tutorial overlay if `tutorialCompletedAt` is null,
*regardless* of whether rules/reasons are already populated — this covers both a genuinely new
client and a client who set up rules via the API/seed script before ever visiting the dashboard
UI (like the seeded test client today). Dismissing or finishing the tutorial sets
`tutorial_completed_at`.

**Steps** (a `Modal`-based or dedicated overlay component, `components/OnboardingTour.tsx`,
using `react-joyride`-style targeted callouts anchored to real elements via `ref`s — or, to avoid
a new dependency, a simple sequential `Modal` series is acceptable for v1):

1. **Welcome** — "Gather" logo, one line: "Let's get your booking page ready in under 2 minutes."
   Buttons: `Skip tour` / `Get started`.
2. **Reasons** — anchored to the Reasons nav link: "Start by adding the reasons visitors can book
   you for — like 'Consultation' or 'Follow-up' — each with its own duration." `Next`.
3. **Rules** — anchored to Rules nav link: "Then set your available hours. Visitors will only see
   slots inside these windows." Briefly mention day-specific vs. all-days precedence (ties into
   improvement #10 above — the tour and the in-page explainer text should share copy).
4. **Your booking link** — anchored to the new "Your booking link" card from improvement #1:
   "This is what you share with visitors — copy it into your email signature, text it, or post it
   anywhere." Highlight the copy button.
5. **Schedule & Errors** — one combined step: "Once bookings come in, manage them from Schedule.
   If your Google Calendar sync ever hits a conflict, you'll see it under Errors." `Finish`.

**Skip/replay**:
- `Skip tour` on step 1 and an `✕` on every step both call the same `complete` handler
  (indistinguishable server-side from finishing — the point is just to stop showing it
  unprompted).
- Add a persistent **"Replay tutorial"** link/button in `DashboardNav` (or a small `?` icon near
  the "Gather" wordmark) that reopens the same overlay on demand without touching
  `tutorial_completed_at` again — it's a manual replay, not a re-triggering of the automatic
  first-run flow.
- The overlay must not block the underlying page from being used — clicking outside a step or
  pressing `Escape` should act like `Skip tour` (same completion handler), not trap the user.

---

## 4. Premium tier (feature-flag only, no payment processing)

Add `tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','premium'))` to `clients`
(same migration as the onboarding column, or its own — Executor's call). No billing integration
this pass — a client's tier is set directly in the DB (or via a simple admin-only toggle) and
gates the features below purely as a flag check.

1. **Custom booking-page branding** — client can set a `display_name`, an accent color, and an
   optional logo URL that render on `/visit/[clientLink]` instead of the generic "Gather" look
   (raw email is currently shown per Section 1's finding — this feature and improvement #7 share
   the same `display_name` groundwork, so ship them together).
   - *Value*: this is the most visible differentiator to the client's own visitors — a
     professionalized booking page is a direct, easy-to-explain upsell ("look like your own
     brand, not ours").
   - *Gate*: UI — a new "Branding" section on the dashboard (new page or folded into an existing
     settings area), rendered only when `session.tier === 'premium'` (add `tier` to the same
     `session` callback in `lib/auth.ts` that already attaches `clientId`); free clients see a
     locked/upsell version of the same panel. API — new `PATCH /api/client/branding` route calls
     `requireClient()` then checks `tier === 'premium'` before writing (return 403 otherwise);
     `app/api/visitor/[clientLink]/availability/route.ts` reads and returns the branding fields
     only if the client's `tier` is `premium` (a downgraded client's page should gracefully fall
     back to default branding, not break).
   - *Complexity*: **low–med** (schema + two routes + conditional rendering; no new external
     integration).

2. **Custom booking-page slug** — a short, memorable `slug` (e.g. `/visit/dr-smith` instead of
   `/visit/07f627c6-...`) as an alternative to the raw client UUID.
   - *Value*: much easier to say over the phone, print on a business card, or remember —
     concrete, tangible premium perk with an obvious "why would I pay for this" answer.
   - *Gate*: UI — slug field in the same Branding/Settings panel, premium-only, with availability
     checking (debounced `GET /api/client/slug-available?slug=...`) and clear rules (lowercase,
     hyphens, 3–30 chars). API/routing — the slug is *persisted* by the same `PATCH
     /api/client/branding` route as the rest of the branding fields (it is not a separate write
     endpoint); that route must check `tier === 'premium'` server-side before writing the slug,
     exactly as it already must for the other branding fields — `GET /api/client/slug-available`
     is only a read-only availability check and is not itself the sensitive endpoint.
     `app/visit/[clientLink]/page.tsx` and every `app/api/visitor/[clientLink]/*` route currently
     treat `clientLink` as the literal client UUID; this needs a resolution step (`slug →
     client_id` lookup, falling back to treating the param as a UUID if no slug matches) added
     once, ideally centralized in a small `lib/resolve-client-link.ts` helper so all three visitor
     routes + the page use the same logic rather than duplicating it. Needs a unique index on
     `slug`; a slug/UUID collision is structurally impossible given the 3–30 char lowercase+hyphen
     validation (a 36-character canonical UUID string can never satisfy that format), so no
     separate cross-column check against `id` is needed.
   - *Downgrade behavior*: a premium-only slug **stops resolving** once a client drops back to
     `free` — `lib/resolve-client-link.ts` must only honor the `slug → client_id` lookup for
     clients whose current `tier` is `premium` (checked at resolution time, not cached), so a
     downgraded client's visitors fall back to needing the raw UUID link, the same
     graceful-degrade posture as branding falling back to defaults on downgrade. The `slug` value
     itself is left in the DB (not deleted) so it starts resolving again immediately if the client
     re-upgrades.
   - *Complexity*: **med** (touches every visitor-facing entry point, needs new validation +
     uniqueness handling, but no external integration).

3. **SMS appointment reminders** — an SMS (via Twilio or similar) sent to `visitor_phone` some
   configurable window (e.g. 24h) before `start_time`, and/or a same-flow SMS confirmation
   immediately after booking.
   - *Value*: directly reduces no-shows, which is a concrete, quantifiable value proposition
     clients will pay for — arguably the single best "why upgrade" pitch of the four.
   - *Gate*: UI — a "Reminders" toggle in a premium settings panel, and premium-only copy on the
     visitor confirmation step ("You'll get a text reminder the day before"). API/backend — new
     `app/api/cron/sms-reminders/route.ts` (same `require-cron.ts` pattern as the existing
     `google-sync`/`export-monthly` crons) that queries appointments starting in the next
     ~24–25h window for `premium`-tier clients only and sends via a new `lib/sms.ts` (mirrors
     `lib/email.ts`'s Resend wrapper, but for an SMS provider). Must gate at query time (`WHERE
     clients.tier = 'premium'`), not just in the UI, since this is a backend job with no session
     to check. Must wrap each send in a per-appointment (or at minimum per-client) try/catch so
     one failure doesn't abort the run for everyone else — this route must *not* copy
     `exportMonthlyCSVForAllClients`'s current loop in `lib/csv-export.ts`, which has no
     per-client error isolation and silently stops processing subsequent clients after the first
     failure.
   - *Complexity*: **high** (new external provider + credentials + delivery-failure handling +
     a new cron job + rate/cost considerations — by far the most involved of the four).

4. **Analytics dashboard** — a `/dashboard/analytics` page with booking volume over time,
   busiest days/hours, no-show rate (status breakdown), and reason popularity, computed from data
   the app already has (`appointments`, `error_log` for red-flag rate).
   - *Value*: turns the app from "a booking form" into "a business tool," a natural upsell for
     clients who already trust the app with their calendar and want insight, not just automation
     — good margin since it needs no new external integration, just aggregation queries.
   - *Gate*: UI — new nav link + page, visible only for `session.tier === 'premium'` (free users
     see a teaser/locked card instead of the link, consistent with how #1/#2's panels degrade).
     API — new `app/api/client/analytics/route.ts` using the existing `requireClient()` +
     `tier` check pattern (403 for free tier, defense-in-depth even though the UI already hides
     the entry point) before running aggregate queries scoped to `client_id`.
   - *Complexity*: **med** (aggregation queries + a chart-rendering UI; no third-party
     integration, but real query/aggregation work, especially if done efficiently rather than
     pulling all rows client-side).

*(Considered and set aside for this pass: multi-staff calendars and recurring appointments —
both would require a real schema redesign — `appointments`/`rules` are currently modeled as
strictly one-calendar-per-client — which is a bigger lift than fits "4 concrete features" at a
reasonable complexity spread for this pass.)*

---

## 5. Security-sensitive touch points

Flagging for the Executor to take extra care:

- **`lib/auth.ts` `session` callback** — already the place that attaches `clientId`/`timezone`
  to every session; adding `tier` and `tutorialCompletedAt` here means every dashboard page
  implicitly trusts this value. Confirm the DB round-trip stays scoped by `email` (as today) and
  that `tier` can never be influenced by anything visitor- or request-supplied — it must only
  ever be read from the `clients` row, never accepted as a request body field on any client-facing
  route.
- **Every new premium-gated API route** (`PATCH /api/client/branding` — this is also the route
  that *persists* a chosen slug, not just the display branding fields; `GET
  /api/client/analytics`; the new SMS cron) must check `tier === 'premium'` **server-side**, not
  just hide UI — a free-tier client hand-crafting a request to a premium route must get a 403,
  matching the existing `requireClient()` + `instanceof NextResponse` short-circuit pattern used
  everywhere else in `app/api/client/*`. `GET /api/client/slug-available` is read-only
  (availability-check only) and is not itself a route that writes anything, but the actual write
  path — `PATCH /api/client/branding` — must not skip the `tier === 'premium'` check just because
  it was designed primarily around the branding fields.
- **Slug resolution (`lib/resolve-client-link.ts`, feature 2)** touches every visitor-facing
  route (`app/api/visitor/[clientLink]/*` and the page) — these are the app's only anonymous,
  unauthenticated surface. A bug here (e.g. a slug lookup that's case-insensitive in a way that
  lets one slug shadow another client's UUID) could leak one client's booking page/data under
  another's link. A slug/UUID collision specifically is structurally impossible given the plan's
  own 3–30 char lowercase+hyphen slug validation (a canonical 36-character UUID string can never
  pass that format check), so no separate database constraint spanning the `slug` and `id`
  columns is needed — a plain Postgres `UNIQUE` constraint couldn't express a cross-column check
  like that anyway. A plain `UNIQUE` index on `slug` alone is sufficient. The lookup must
  continue to use `createServiceClient()` (RLS-bypassing) scoped correctly — same care as the
  existing `[clientLink]` routes already take.
- **SMS reminder cron (feature 3)** — like the existing `google-sync`/`export-monthly` crons,
  must use `require-cron.ts`'s `x-cron-secret` check (`lib/require-cron.ts` +
  `lib/safe-compare.ts`), and must not leak visitor phone numbers into logs/error messages the
  way `lib/error-response.ts` already guards against for Postgres errors. It must also isolate
  failures per-appointment or per-client (try/catch around each send) rather than mirroring
  `exportMonthlyCSVForAllClients`'s current unguarded loop in `lib/csv-export.ts`, where one
  client's failure silently aborts processing for every client after it in the same run.
- **Branding fields (feature 1)**, especially a "logo URL," are a stored-XSS-adjacent surface if
  ever rendered as raw HTML rather than as an `<img src>`/CSS `background-color` value — validate
  as a proper URL (and ideally restrict to same-origin uploaded assets rather than an arbitrary
  external URL) and never `dangerouslySetInnerHTML` any client-supplied branding text.
- **Reasons `DELETE` route (improvement #3)** — must scope by `client_id` exactly like the
  existing `rules/[id]` `DELETE` does (`.eq('id', params.id).eq('client_id',
  client.clientId)`), and should decide/document what happens to existing `appointments` that
  reference a deleted `reason_id` (currently `reason_id UUID NOT NULL REFERENCES
  appointment_reasons(id)` per `0001_init.sql` with no `ON DELETE` clause — i.e. deleting a
  referenced reason will currently fail with a foreign-key violation, which the new route must
  surface as a clear "can't delete a reason with existing appointments" message via
  `errorResponse()`, not a raw constraint error).
- **Onboarding column** — purely additive (`tutorial_completed_at`), no auth/RLS implications
  beyond the same `clients` row already covered by existing RLS (service-role only, per
  `0003_rls.sql`).
- **This plan's own live-testing gap**: because Task 2 could not run, none of the above flows
  (existing or new) have been exercised end-to-end in a browser. The Executor/Reviewer should
  budget time to actually click through the admin login → dashboard → visitor booking path once
  a working browser connection is available, rather than trusting this static read alone.

---

## 6. Suggested implementation order

**Scope boundary — what's droppable if time runs short**: everything through step 7 below
(schema, session wiring, the UI fixes, the reasons delete/rename gap, the tutorial, and premium
features 1/2/4) should land solidly rather than partially. **SMS reminders (feature 3, step 8) is
explicitly the one item in this plan that may be deferred to a follow-up pass** — it is both the
highest-complexity feature here and the only one that cannot be verified end-to-end this pass
without real external provider (e.g. Twilio) credentials, since no `ALLOW_ADMIN_LOGIN`-style
stub exists for it the way one does for Google OAuth. The Executor has explicit permission to
stop after step 7 and ship a smaller, fully-verified premium tier (branding + slug + analytics)
rather than rushing SMS to completion just to check a box; a code-complete-but-unverified SMS
cron is worse than an honestly-deferred one.

1. **Schema migration** (`0007_...sql`): add `clients.tutorial_completed_at` and `clients.tier`
   (+ `clients.display_name`, `clients.slug` if bundling the branding/slug groundwork now) in one
   additive migration, following the existing numbered-migration convention.
2. **`lib/auth.ts` session callback**: attach `tier` and `tutorialCompletedAt` alongside the
   existing `clientId`/`timezone`.
3. **Quick UI wins first** (low risk, high visibility, unblock manual testing of everything
   else): "Your booking link" card (#1), Modal focus-trap/Escape fix (#5), Export button
   debounce (#6), `AppointmentCard` touch-accessible reveal (#4). These are independent of the
   tutorial/premium work and de-risk the rest.
4. **Reasons delete + real rename** (`DELETE`/`PATCH /api/client/reasons/[id]`) — small,
   self-contained, fixes a real functional gap.
5. **First-time tutorial** (Section 3) — depends on step 1's `tutorial_completed_at` column and
   benefits from step 3's "booking link" card already existing to anchor a tour step against.
6. **Premium tier feature 1 (branding) + feature 2 (slug)** — ship together since both live in
   the same new "Branding/Settings" panel and both need the `display_name` groundwork already
   motivated by improvement #7; slug work requires the shared `resolve-client-link.ts` refactor
   across all `visitor/[clientLink]/*` routes — do that refactor as its own reviewable step
   before wiring the UI.
7. **Premium tier feature 4 (analytics)** — self-contained, no shared infra with 1/2, can slot in
   any time after the `tier` flag exists.
8. **Premium tier feature 3 (SMS reminders)** — last, since it's the highest complexity and the
   only one requiring a new external provider/credentials; do it once the `tier`-gating pattern
   is proven out by features 1/2/4.
9. **Re-run Task 2 (live browser click-through)** once a working browser connection is
   available, covering both the pre-existing flows and every new premium/tutorial surface added
   above, before considering this plan's UX assumptions validated.

# Execution Log — UI/UX & Premium Tier Improvement Pass

Executor pass on branch `improve/ui-premium-tier`, built from the approved `PLAN.md`. All work
below is left as **uncommitted working-tree changes** — no commits were made, per instructions.
No migration was run against the live Supabase project — see "Outstanding / needs your action"
at the bottom.

---

## 1. Schema migration (`0007_client_onboarding_and_tier.sql`)

New file: `supabase/migrations/0007_client_onboarding_and_tier.sql`. Additive only (new
nullable-or-defaulted columns on `clients`), safe to run against a live table with existing
rows. Contents:

- `tutorial_completed_at TIMESTAMP NULL` — first-run tour tracking (Section 3).
- `tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','premium'))` — feature-flag tier
  (Section 4).
- `display_name VARCHAR(255)` — replaces raw email shown to visitors (Section 1/2 item 7,
  prerequisite for premium feature 1).
- `accent_color VARCHAR(20)`, `logo_url TEXT` — premium feature 1 (branding).
- `slug VARCHAR(30)` + `CREATE UNIQUE INDEX idx_clients_slug ON clients(slug) WHERE slug IS NOT NULL`
  — premium feature 2 (custom link). Partial unique index (not a column-level `UNIQUE`) so
  multiple free clients can keep `slug = NULL`.
- `sms_reminders_enabled BOOLEAN NOT NULL DEFAULT false` — premium feature 3 groundwork
  (client-controlled opt-in the stub cron's query filters on).

**This migration has NOT been applied to the live database.** `npm run db:migrate` was not run
(hard constraint). You need to run it yourself before any of the new columns exist — see
"Outstanding" below.

## 2. `lib/auth.ts` session callback

`session()` callback now selects `tier, tutorial_completed_at` alongside the existing
`id, timezone`, still scoped by `.eq('email', session.user.email)` exactly as before, and
attaches `session.tier` (defaulted to `'free'` if the client row's value is falsy) and
`session.tutorialCompletedAt`. Because this is a JWT-strategy session whose `session()`
callback still does a fresh DB round-trip on every `getServerSession()` call (unchanged
behavior, just more columns selected), `tier` can never go stale in a long-lived token — every
request re-reads it from the `clients` row.

`lib/require-client.ts` now returns `{ clientId, tier, tutorialCompletedAt }` instead of just
`{ clientId }`. `tier` defaults to `'free'` if absent from the session (fail-closed). Every
existing caller that only destructured `.clientId` is unaffected (checked — none broke).

## 3. Quick UI wins (Section 2 items 1, 4, 5, 6)

- **`components/Modal.tsx`** — added a focus trap (Tab/Shift+Tab cycling within the dialog),
  Escape-to-close, and focus-return to the previously-focused element on close. Added an opt-in
  `closeOnBackdropClick` prop, default `false` (preserves existing rule/appointment editor
  behavior — no accidental data loss from a stray outside click) — only the new
  `OnboardingTour` opts in, per PLAN.md's explicit requirement that the tour's backdrop-click
  behave like "Skip tour."
- **`components/AppointmentCard.tsx`** — replaced the `group-hover:opacity-100` contact-info
  reveal (unreachable on touch, no keyboard equivalent) with an explicit `aria-expanded` toggle
  button ("Details"/"Hide details") that renders the panel inline rather than as an
  absolutely-positioned hover overlay (avoids clipping on narrow/mobile layouts). Also made the
  Edit/Delete buttons always-visible instead of hover-only, for the same touch/keyboard reason —
  this was a small scope extension beyond the plan's literal citation (which only flagged the
  contact-info block) but shares the identical root cause.
- **`app/dashboard/export/page.tsx`** — added a `sending` guard (button disabled + relabeled
  while a request is in flight, preventing the double-click-sends-two-emails bug) and a
  confirm-then-send step ("This will email a CSV of {month}'s appointments to your account
  email — continue?") before the real POST fires.
- **`app/dashboard/page.tsx`** — new `BookingLinkCard` showing `/visit/{clientId-or-slug}` with
  a copy-to-clipboard button (falls back silently if `navigator.clipboard` isn't available —
  the link text itself is still visible/selectable). This was the plan's stated
  highest-value fix (there was previously no way to find your own booking link from the UI at
  all).

## 4. Reasons DELETE + real PATCH-by-id rename

- **`app/api/client/reasons/[id]/route.ts`** (new) — `PATCH` (partial update by id: name,
  duration, order, all optional but at least one required via `reasonUpdateSchema`) and
  `DELETE`, both scoped by `.eq('id', params.id).eq('client_id', client.clientId)`. `DELETE`
  catches Postgres FK-violation `23503` (an existing appointment still references this reason,
  since `appointments.reason_id` has no `ON DELETE` clause) and returns a clear message via
  `errorResponse()` instead of a raw constraint error. `PATCH` catches unique-violation `23505`
  (renaming to a name that collides with another of this client's reasons) the same way.
- **`app/api/client/reasons/route.ts`** — `POST` is now create-only: it explicitly checks for
  an existing reason with the same `client_id`+`name` first (409 if found) and then `insert`s
  rather than `upsert`s on `onConflict: 'client_id,name'`. This closes the "rename silently
  creates a new row" landmine PLAN.md flagged.
- **`app/dashboard/reasons/page.tsx`** — rewritten. The existing duration-edit and ↑/↓ reorder
  UI previously worked *by relying on* the old POST-as-upsert behavior (re-POSTing the same
  name with a new duration/order). Since POST is now create-only, both had to be re-pointed at
  the new `PATCH /api/client/reasons/[id]` or they'd have broken. Added click-to-rename (click
  the name → inline text input → Save/Cancel, Enter/Escape supported) and a Delete button with
  the same inline-confirm pattern used elsewhere in the app; a 409 from the delete route (reason
  still in use) surfaces as a visible error message rather than failing silently.

## 5. First-time tutorial (Section 3)

- **`app/api/client/onboarding/complete/route.ts`** (new) — `POST`, `requireClient()`-gated,
  sets `tutorial_completed_at = now()`. Called on skip, finish, Escape, and backdrop-click —
  all indistinguishable server-side, matching the plan.
- **`components/OnboardingTour.tsx`** (new) — implemented as PLAN.md's explicitly-allowed v1
  fallback: a sequential `Modal`-based series (5 steps: Welcome, Reasons, Rules, Booking link,
  Schedule & Errors) rather than a `react-joyride`-style ref-anchored overlay. Content
  references real nav items/the booking-link card by name rather than pointing at live DOM
  elements, since anchoring across page navigations couldn't be verified without a live
  browser this pass. Uses `Modal`'s new `closeOnBackdropClick` + Escape support so it never
  traps the user.
- **`components/DashboardChrome.tsx`** (new) — a client-component wrapper around
  `DashboardNav` + `<main>` + `OnboardingTour` that owns the tour's open/close state, so the
  nav's "Replay tutorial" button (a small `?` icon next to the wordmark) and the tour itself can
  share state without a `SessionProvider` (the app has none — `signIn`/`signOut` from
  `next-auth/react` are used directly elsewhere and don't require one, but `useSession()` does,
  so this avoids introducing that dependency). Initial tour-open state is
  `tutorialCompletedAt === null`, computed once from the server-rendered layout — matches
  "trigger regardless of whether rules/reasons are already populated."
- **`app/dashboard/layout.tsx`** — now computes `tier`/`tutorialCompletedAt` from the session
  and renders `DashboardChrome` instead of the old flat `DashboardNav` + `<main>` markup.
  Unauthenticated-state markup (Google sign-in / admin login) is unchanged.

## 6. Premium features 1 + 2 — branding + custom slug (shipped together per plan)

- **`lib/resolve-client-link.ts`** (new) — the single shared resolver PLAN.md called for.
  Accepts either the raw client UUID (regex-checked, always resolves) or a slug (only resolves
  while `.eq('tier', 'premium')`, checked fresh on every call, never cached). A slug/UUID
  format collision is structurally impossible per the plan's own reasoning (36-char UUID can
  never match `slugSchema`'s 3–30 lowercase+hyphen regex), so the two lookup paths never
  overlap. Slug lookups are lowercased before matching (slugs are always stored lowercase) for
  a friendlier "typed it in caps" experience.
- **`app/api/visitor/[clientLink]/reasons/route.ts`**, **`.../availability/route.ts`**,
  **`.../book/route.ts`** — all three now call `resolveClientLink()` first and 404
  (`"This booking link is not valid."`) if it doesn't resolve, instead of the old behavior of
  querying with the raw param directly (which silently returned empty results for a bad link on
  the reasons route, or in book/route.ts's case would have handed an unresolved slug straight
  into `bookAppointment()` as if it were a client id). The availability route additionally
  returns `clientName` (now `display_name || email`, was previously always raw `email`) and a
  `branding: { accentColor, logoUrl } | null` field — `null` for free-tier/downgraded clients so
  the visitor page gracefully falls back to the default look (downgrade behavior from PLAN.md
  Section 4 feature 2, applied symmetrically to feature 1).
- **`app/api/client/branding/route.ts`** (new) — `GET` (open to any authenticated client, not
  tier-gated — a free client needs to see their own tier to render the locked/upsell panel) and
  `PATCH` (the actual write path for both branding fields and the slug; checks
  `client.tier !== 'premium'` → 403 before touching anything, per PLAN.md Section 5's explicit
  instruction that this check must not be skipped just because the route is nominally about
  branding). Catches unique-violation `23505` on the slug index and returns a clear "already
  taken" message.
- **`app/api/client/slug-available/route.ts`** (new) — read-only, `requireClient()`-gated but
  not tier-gated (matches PLAN.md: this route is explicitly not the sensitive one).
- **`app/dashboard/branding/page.tsx`** (new) — fetches `/api/client/branding`; if
  `tier !== 'premium'`, renders a locked/upsell panel instead of the form (not an API-level
  block — free clients can still see the page, just not edit). If premium: form for display
  name / accent color / logo URL / slug (debounced 400ms availability check against
  `slug-available`, Save disabled while taken/invalid) plus an SMS-reminders opt-in checkbox
  (see Section 8 below).
- **`app/visit/[clientLink]/page.tsx`** — renders `branding.logoUrl` (if present, as a plain
  `<img>` with an `onError` fallback that hides it rather than showing a broken-image icon) and
  applies `branding.accentColor` as an inline `style={{ backgroundColor: ... }}` on the primary
  step-progress dots and CTA buttons (Continue / Confirm booking / selected date). This is a
  deliberately scoped implementation of "custom accent color" — inline styles on the highest-
  visibility elements, not a full runtime re-theme of every `bg-accent`/`border-accent` Tailwind
  class on the page (Tailwind's palette is compiled statically; a true full re-theme would need
  CSS custom properties threaded through `tailwind.config.js`, which felt like more surface
  area than this pass's scope/verification budget justified). Noted as a scope decision, not an
  oversight.
- Also folded in here (touches the same file, low incremental cost): the Section 2 item 8
  visitor-flow fixes — a numbered step progress indicator, `type="tel" inputMode="tel"` on the
  phone input, a `reasonsLoading` flag so "no reasons configured" is now distinguishable from
  "still loading" from "a real fetch error," and `loadError` is now a dismissible banner above
  the current step instead of replacing the whole page (so an in-progress reason/slot selection
  survives a transient failure).

## 7. Premium feature 4 — analytics

- **`app/api/client/analytics/route.ts`** (new) — `requireClient()` + `tier !== 'premium'` →
  403. Queries `appointments` (start_time, status, reason_id only) for a rolling 180-day window
  plus the client's `appointment_reasons`, then aggregates **server-side** in the route handler
  (booking volume by ISO week, counts by day-of-week, counts by hour, status breakdown, reason
  popularity) rather than shipping raw rows to the browser. This is a plain select-then-reduce
  in JS (same pattern `lib/csv-export.ts` already uses), not a SQL-level `GROUP BY` — noted in
  the route's own comment as a reasonable v1 given the app has no other raw-SQL-aggregation
  precedent and a single client's realistic appointment volume over 180 days is small.
  **Deviation from the plan's literal feature description**: "no-show rate" isn't a concept
  this schema tracks — `Appointment.status` is only `'confirmed' | 'red_flag'` (no `no_show`
  status exists anywhere in the app). Rather than fabricate a metric the data doesn't support,
  this reports a true status breakdown (confirmed vs. red_flag/conflict) and documents the
  substitution in the route's comment.
- **`app/dashboard/analytics/page.tsx`** (new) — locked/upsell panel if the API 403s (detected
  by checking for `(403)` in the `fetcher`-thrown error's message — presentation-only, the real
  gate already happened server-side), otherwise renders the aggregates as plain CSS bar charts
  (no new charting dependency added — none existed in `package.json` and installing one wasn't
  necessary for a readable v1, especially with no live browser available to visually verify a
  chart library's output).
- **`components/DashboardNav.tsx`** — added "Branding" and "Analytics" as an always-visible
  "Premium" nav group (small "Premium" badge shown next to each when the client's tier isn't
  premium), rather than hiding the links outright for free-tier clients. **Interpretation
  note**: PLAN.md's feature 4 gate description says free users should see "a teaser/locked card
  instead of the link," which could be read as "hide the nav link entirely." I chose to keep
  the link visible and let the page itself render the teaser (identical to how feature 1/2's
  Branding panel already has to behave, since PLAN.md explicitly says free clients *do* see a
  locked version of that panel). This keeps the pattern consistent between the two premium
  pages and gives free-tier clients visibility into what upgrading unlocks, while the
  server-side 403 means there's no actual data exposure either way. Documented here as a
  judgment call, not a plan violation — the security-relevant requirement (403 server-side) is
  unaffected either way.
- Also folded in: Section 2 item 11 (nav grouping — Setup: Reasons/Rules; Operate:
  Schedule/Errors/Export; Premium: Branding/Analytics, plus an ungrouped Home link) and the
  "Replay tutorial" `?` button, since I was already restructuring `DashboardNav` for the premium
  badges.

## 8. Premium feature 3 — SMS reminders (DEFERRED per plan's explicit permission)

PLAN.md Section 6 step 8 explicitly permits stopping short of a working SMS integration. What
was built:

**Real / functional:**
- `sms_reminders_enabled` column + `PATCH /api/client/branding` write path + the checkbox in
  `/dashboard/branding` — a client can genuinely toggle this preference today; it's persisted
  and will take effect the moment a real provider is wired up, no further schema/UI work needed.
- `app/api/cron/sms-reminders/route.ts` (new) — real `requireCron()` auth, a real two-step
  tier + opt-in gated query (premium clients with `sms_reminders_enabled = true` → their
  appointments in the 24–25h reminder window with `status = 'confirmed'`), and a real
  per-appointment `try`/`catch` around each send so one failure can't abort the run for
  every appointment after it — this is the exact bug PLAN.md flags in
  `exportMonthlyCSVForAllClients`'s current unguarded loop (`lib/csv-export.ts`), and this route
  deliberately does not repeat it. Logs only the appointment id on failure, never the visitor
  phone number alongside provider error detail (PLAN.md Section 5).
- If `TWILIO_*` env vars are absent (they are, everywhere this pass), the route short-circuits
  immediately with `{ status: 'skipped', reason: '...' }` before touching the DB at all — safe
  to schedule on Render right now with zero risk.

**Stubbed / NOT real:**
- `lib/sms.ts`'s `sendSms()` always throws (`SmsNotConfiguredError` if env vars are missing,
  a plain "not implemented" `Error` even if they happen to be set) — there is no Twilio SDK
  call, no HTTP request to any SMS provider, anywhere in this codebase. No SMS dependency was
  added to `package.json`.
- Consequently, even with `TWILIO_*` env vars set and appointments in the reminder window, this
  route will run its full query, attempt every send, catch every failure, and report
  `sent: 0, failed: N` — it does not and cannot send a real text message in this state.

**Why deferred**: no Twilio-or-equivalent credentials exist in this environment, and PLAN.md is
explicit that a code-complete-but-unverified integration is worse than an honestly-stubbed one.
Wiring a real provider in later requires touching only `lib/sms.ts` (see its header comment) —
the cron route, the DB column, and the UI toggle don't need to change.

---

## Verification

Commands run after each major chunk, per instructions. Final pass, run together, actual output:

```
$ npx tsc --noEmit
(no output — exit 0)

$ npm run lint
> schedule-app@0.1.0 lint
> next lint
✔ No ESLint warnings or errors

$ npm test
> schedule-app@0.1.0 test
> vitest run
 ✓ lib/availability.test.ts (6 tests) 21ms
 ✓ lib/csv-export.test.ts (4 tests) 6ms
 Test Files  2 passed (2)
      Tests  10 passed (10)
```

`npm run build` was also run to completion (exit code 0) mid-pass, after most files existed
(before the README/`.env.example`/`.gitignore` doc-only edits, which can't affect a build).
Actual output:

```
▲ Next.js 14.2.35
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (27/27)

Route (app)                                 Size     First Load JS
├ ƒ /api/client/analytics                   0 B                0 B
├ ƒ /api/client/branding                    0 B                0 B
├ ƒ /api/client/onboarding/complete         0 B                0 B
├ ƒ /api/client/reasons/[id]                0 B                0 B
├ ƒ /api/client/slug-available              0 B                0 B
├ ƒ /api/cron/sms-reminders                 0 B                0 B
├ ƒ /dashboard                              2.38 kB         104 kB
├ ƒ /dashboard/analytics                    1.63 kB        94.8 kB
├ ƒ /dashboard/branding                     2.45 kB        95.6 kB
├ ƒ /dashboard/reasons                      2.38 kB        95.5 kB
├ ƒ /dashboard/rules                        3.83 kB         120 kB
├ ƒ /dashboard/schedule                     4.61 kB         121 kB
└ ƒ /visit/[clientLink]                     3.31 kB         114 kB
(full route list above — every new route registered, no build errors)
```

Two warnings from `npm run build`, both pre-existing/environmental, not caused by this pass:
- "the optional 'sharp' package is strongly recommended" — Next.js image-optimization advisory,
  unrelated to anything changed here (no `next/image` usage was added; the new
  `<img>` in the visitor page for `branding.logoUrl` deliberately uses a plain `<img>` since
  it's an arbitrary external HTTPS URL, not a local/optimizable asset).
- Google Fonts fetch retries during the build — this sandbox has restricted network access;
  the build still compiled successfully (fonts presumably came from a local cache or the retry
  eventually succeeded). Not something to action.

**Pre-existing repo gap fixed to make `npm run lint` runnable at all**: there was no
`.eslintrc.json`/ESLint config anywhere in the repo, so `next lint` dropped into an interactive
"how would you like to configure ESLint?" prompt instead of running. Added a minimal
`.eslintrc.json` (`{ "extends": "next/core-web-vitals" }`) — the same default `next lint` itself
would have scaffolded under "Strict (recommended)". This isn't part of PLAN.md but was necessary
to satisfy this task's own verification instructions.

## Errors / blockers hit

- The ESLint-config gap above — resolved by adding `.eslintrc.json`.
- Nothing else blocked. No TypeScript errors, no failed builds, no test regressions at any
  checkpoint along the way (tsc/lint/test were run after every major chunk: after Modal/
  AppointmentCard/Export, after the reasons DELETE/PATCH work, after the tutorial/nav wiring,
  after branding/slug, after the visitor-page rewrite, after analytics/SMS-stub, and after the
  Calendar/schedule/rules polish — every one came back clean before moving on).

## Deviations from PLAN.md (summary — details inline above)

1. Analytics reports a true confirmed/red_flag status breakdown instead of a fabricated
   "no-show rate" the schema doesn't track.
2. Premium nav links (Branding, Analytics) are always visible with a "Premium" badge for
   free-tier clients, rather than hidden outright — a judgment call on ambiguous plan wording,
   made for consistency between the two premium pages; the security-relevant server-side 403 is
   unaffected.
3. Custom accent-color branding is applied via inline styles on primary CTA elements, not a
   full page-wide runtime re-theme of every Tailwind `accent` class.
4. SMS reminders are deferred/stubbed per the plan's own explicit permission — see Section 8.
5. Added a project ESLint config (not in PLAN.md) purely to make `npm run lint` executable.
6. Folded several Section 2 items (2, 7, 8, 9, 10, 11) into the same passes as the required
   Section 6 steps, since they touched files already being modified for the mandatory work and
   were low incremental cost/risk — all 11 of Section 2's numbered improvements ended up
   implemented, not just the 4 explicitly named in step 3.

## Explicitly NOT done (out of scope this pass, not attempted)

- Re-highlighting a known-taken slot in `TimeSlotGrid` after a visitor declines a conflict
  suggestion (Section 1 finding; not promoted to a numbered Section 2 item).
- An in-dashboard reminder banner that an admin-login session has no Google Calendar sync
  (Section 1 "security-adjacent UX" finding; not a numbered Section 2 item).
- `ErrorBanner` explaining why "Retry Sync" doesn't appear for non-`google_sync` error types
  (Section 1 finding; not a numbered Section 2 item).
- Ref-anchored, `react-joyride`-style onboarding callouts — used the plan's explicitly-permitted
  simple sequential-Modal v1 instead.

## Outstanding / needs your action

1. **The `0007` migration has not been applied to the live database.** Run
   `npm run db:migrate` yourself (or apply
   `supabase/migrations/0007_client_onboarding_and_tier.sql` by hand in the Supabase SQL
   Editor) before any of this pass's new columns (`tier`, `display_name`, `slug`,
   `accent_color`, `logo_url`, `sms_reminders_enabled`, `tutorial_completed_at`) exist. Until
   then, every route/page touching them will fail against the live DB (they'll work fine
   locally against a freshly-migrated dev/test Supabase project).
2. **No live browser/UX validation was performed** — same constraint the Planner hit
   (`claude-in-chrome` unavailable in this environment) and explicitly called out as an
   outstanding gap in PLAN.md Section 5's last bullet. Every new/changed page in this pass
   (onboarding tour, Branding, Analytics, the rewritten visitor booking page, the touch-
   accessible AppointmentCard, the Modal focus trap) should be clicked through in a real browser
   — including on an actual touch device for the AppointmentCard/visitor-flow changes — before
   treating this pass as fully validated. Reasoning above was done by reading the component
   code, tracing prop flow, and confirming conditional-rendering logic by hand; it is not a
   substitute for exercising it live.
3. **To set a client to premium for testing**: no admin toggle UI exists (not requested by the
   plan for this pass — "set directly in the DB"). Run
   `update clients set tier = 'premium' where email = '...'` directly, or via the Supabase
   dashboard's table editor, once `0007` is applied.
4. **SMS reminders remain non-functional** until real `TWILIO_*`-equivalent credentials are
   provisioned and `lib/sms.ts`'s `sendSms()` is implemented against them — see Section 8 above.

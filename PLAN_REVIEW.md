# Plan Review — `improve/ui-premium-tier`

## Verdict: REVISE

The research underlying this plan is unusually well-grounded — I spot-checked roughly 20 file/line
citations against the actual code (`lib/auth.ts`, `lib/require-client.ts`,
`lib/booking.ts`, `lib/csv-export.ts`, `lib/require-cron.ts`, `lib/error-response.ts`,
`app/api/visitor/[clientLink]/{availability,book,reasons}/route.ts`,
`app/api/client/{reasons,rules/[id],dashboard}/route.ts`, `components/{AppointmentCard,Modal,
Calendar,DashboardNav,ErrorBanner}.tsx`, `app/dashboard/{rules,export,page}.tsx`,
`app/visit/[clientLink]/page.tsx`, `supabase/migrations/{0001_init,0003_rls}.sql`,
`package.json`) and every one checked out — line numbers, quoted code, and behavioral claims
(e.g. `clientName: client.email` at exactly the cited line, the `onConflict: 'client_id,name'`
upsert, the `group-hover`-only reveal, Modal's missing focus trap, the rules `DELETE` scoping
pattern) were all accurate. This is not a rubber-stamp REVISE — it's close, and the fixes needed
are narrow. But there are real gaps, mostly concentrated in Section 5, plus one legitimate scope
concern, that should be addressed before the Executor starts.

---

## Complexity assessment

The four premium features' individual complexity ratings are believable and, if anything,
appropriately conservative:

- **Branding (low–med)** and **Analytics (med)** are correctly scoped — no external
  integration, straightforward CRUD/aggregation against existing tables. One nit: Analytics
  says "no third-party integration" for a chart-rendering UI, but `package.json` has no charting
  library at all (no `recharts`/`chart.js`/etc.) — doable with hand-rolled CSS bars for the
  described metrics, but the plan should say that explicitly rather than imply charts are free.
- **Slug (med)** is realistic — I confirmed `app/api/visitor/[clientLink]/reasons/route.ts`
  already has a comment anticipating exactly this change ("Swap to a dedicated short slug column
  later... the lookup here is the only place that'd change"), and `lib/booking.ts` passes
  `clientId` straight into a Postgres RPC that expects a UUID type, confirming resolution must
  happen before any of the three visitor routes touch the DB. The estimate is fair.
- **SMS reminders (high)** is correctly flagged as the hardest of the four, but the plan
  understates one thing: unlike Google OAuth, which has a documented workaround
  (`ALLOW_ADMIN_LOGIN`) so the app can be exercised without real Google Cloud credentials, there
  is no equivalent stub for Twilio (or whatever SMS provider). This feature is likely to be
  code-complete but **unverifiable end-to-end** this pass, purely because real provider
  credentials don't exist yet — same category of gap the plan already self-flags for browser
  testing (Task 2).

The bigger issue is aggregate scope, not any single feature: 11 UI fixes (several nontrivial —
new DB-backed reasons DELETE/PATCH route, a new `display_name` field threaded through two
routes, a rewritten visitor-flow error/loading model) **plus** a full tutorial system (migration
+ new component + new API route + nav change) **plus** all four premium features (schema +
5 new/changed API routes + a cross-cutting `resolve-client-link.ts` refactor touching every
visitor-facing route + a new external SMS integration) is a lot to land reliably in one Executor
pass with no checkpoint in between. Section 6 orders the work sensibly but never says what's
droppable if time runs out, so the Executor has no signal for when to stop versus rush the
riskiest, least-testable feature (SMS) to completion.

## Security assessment

This is the section I was most critical of, and where I found the most real (if narrow) gaps:

1. **`tier` un-spoofability — confirmed sound.** I checked: the only code that writes to
   `clients` is `lib/auth.ts`'s `signIn` upsert (scoped to `email`/`google_id`/
   `google_refresh_token` only) and the plan's new premium routes. There is no existing generic
   "update your client row" endpoint that could let a client sneak `tier` in via a stray body
   field, and the `session` callback re-fetches `tier` fresh from the DB by `email` on every
   call rather than trusting anything in the JWT — so the plan's requirement ("never accepted as
   a request body field") is both correct and already consistent with how the codebase works.
   No changes needed here.

2. **Slug write path is missing from the enforcement checklist.** Section 5's bullet on
   premium-gated routes lists `PATCH /api/client/branding`, `GET /api/client/slug-available`,
   `GET /api/client/analytics`, and the SMS cron as needing server-side tier checks — but never
   names the route that actually *persists* a chosen slug (Section 4 only says the slug field
   lives "in the same Branding/Settings panel," implying it's bundled into the branding PATCH,
   but this is never stated explicitly). The availability-check GET is not the sensitive
   endpoint; the write endpoint is. This needs to be named explicitly so it isn't the one route
   in the feature that ships without the tier + uniqueness check.

3. **Slug/UUID collision mechanism is asserted, not specified.** Section 5 says this "needs a
   uniqueness constraint that considers both the `slug` column and the `id` (UUID) column
   together" — but a plain Postgres `UNIQUE` constraint can't cross-check one row's `slug`
   against another row's `id` column; that requires either an app-level check inside the same
   write path or is otherwise handled. In practice this risk is mostly moot by construction: the
   plan's own slug validation (3–30 chars, lowercase+hyphens) makes it impossible for a slug to
   ever equal a canonical 36-character UUID string, so the collision the plan worries about can't
   actually happen given the stated validation rules. The plan should just say this explicitly
   instead of leaving an unresolved-sounding "needs a constraint" note that implies more work
   than is actually required.

4. **No fault isolation specified for the SMS cron.** I checked the existing analogous pattern —
   `exportMonthlyCSVForAllClients` in `lib/csv-export.ts` loops over all clients with **no
   per-client try/catch**, so one client's failure aborts the loop and every subsequent client
   silently doesn't get exported that run. The plan's SMS reminder cron is described the same
   way ("queries appointments... for premium-tier clients... and sends via `lib/sms.ts`") with
   no mention of per-appointment/per-client error isolation. Given the plan itself pitches SMS
   reminders as "arguably the single best why-upgrade pitch," a paying client silently not
   getting reminders sent because another client's phone number/Twilio call failed earlier in
   the same run is a real reliability problem worth calling out explicitly, not just inheriting
   silently from the existing export pattern.

5. **Slug behavior on downgrade is undefined.** The plan explicitly specifies that branding
   gracefully falls back to defaults if a client is downgraded ("a downgraded client's page
   should gracefully fall back to default branding, not break") but says nothing about what
   happens to a premium-only custom slug on downgrade — does `/visit/dr-smith` keep resolving
   forever once a client has ever been premium, or does resolution start rejecting it (falling
   back to requiring the UUID)? Either answer is defensible, but the plan should pick one instead
   of leaving it for the Executor to improvise mid-implementation.

None of these are catastrophic — nothing here would let one client see another's data via a
plausible attack path I could find, and the core `tier`-trust model is sound — but they're
concrete, fixable gaps in the one section (Section 5) whose entire job is to be exhaustive about
exactly this kind of thing.

## Earnings / feature-potential assessment

The four features are a coherent, sellable premium tier and map closely to how a real
competitor (Calendly-style tools) actually monetizes: custom branding, a vanity URL, no-show
reduction via reminders, and business analytics. The free tier stays fully functional (booking,
rules, Google Calendar sync, CSV export, error handling all remain free), so it doesn't read as
crippled, while premium adds genuinely visible, easy-to-explain upgrades rather than arbitrary
limits — that's the right shape for a premium split. Correctly deferring multi-staff calendars
and recurring appointments (real schema redesigns) and explicitly excluding payment processing
(per the task's own framing) were both sound calls; I didn't find a clearly better feature the
plan missed given that "no payment processing" constraint. Analytics is arguably the softest of
the four in terms of willingness-to-pay (nice-to-have vs. must-have), but it's cheap to build
from data the app already has and rounds out the tier reasonably — not worth swapping out.

## Sections 1–3 sanity check

Static findings in Section 1 are consistently accurate — every citation I checked (file, line
range, and quoted behavior) matched the real code exactly, including some fairly specific claims
(the reasons-rename landmine via `onConflict: 'client_id,name'`, the FK-violation-on-delete gap
for reasons, the hover-only contact reveal). The tutorial design in Section 3 is sound on its
core properties — server-tracked completion (`tutorial_completed_at`, not localStorage),
distinct skip vs. replay handling, and explicit non-blocking behavior (Escape/outside-click ==
skip, never a trap). One inaccuracy to fix: the early paragraph claims the tutorial trigger is a
"cheap, already-fetched signal — no new API call needed" because "`DashboardResponse.rules` is
already loaded" — but I confirmed `app/api/client/dashboard/route.ts` does not fetch or return
`appointment_reasons` at all (only `appointments`, `rules`, `errors`), so a signal based on both
rules *and* reasons being empty isn't actually free. This is harmless in practice because the
plan's own later paragraph ("Trigger condition, precisely") correctly settles on
`tutorialCompletedAt === null` alone and doesn't depend on reasons — but the earlier paragraph
should be corrected or deleted so the Executor isn't given two different, one of them wrong,
descriptions of the trigger condition.

---

## What must change before approval

1. **Add an explicit scope boundary for this pass.** State plainly in Section 6 (or a new short
   note) what's droppable if time runs out — specifically, permit deferring SMS reminders
   (feature 3) to a follow-up pass, since it's both the highest-complexity item and the one
   feature that can't be verified end-to-end without real external provider credentials (no
   `ALLOW_ADMIN_LOGIN`-style stub exists for it the way it does for Google OAuth). The Executor
   should have explicit permission to land everything else solidly rather than rushing SMS to
   check a box.
2. **Name the slug write endpoint explicitly in Section 5's enforcement checklist**, and confirm
   it — not just `GET /api/client/slug-available` — checks `tier === 'premium'` server-side
   before persisting a slug.
3. **Tighten the slug/UUID-collision language.** Either state explicitly that the 3–30 char slug
   validation already makes a slug/UUID collision structurally impossible (so no separate
   cross-column constraint is needed), or, if the Planner intends looser slug validation later,
   specify that the check must happen at the application layer in the same write path — not
   describe it as a database constraint that Postgres can't actually express across two columns.
4. **Specify fault isolation for the SMS reminder cron** (per-appointment or per-client
   try/catch so one failure doesn't silently abort reminders for every other client in the same
   run) — call out that this should *not* mirror `exportMonthlyCSVForAllClients`'s current
   unguarded loop.
5. **State the intended behavior for a premium-only slug after downgrade** (keeps resolving vs.
   stops working), matching the level of detail already given for branding's downgrade behavior.
6. **Fix the tutorial-trigger paragraph** in Section 3 that incorrectly claims the "both rules
   and reasons empty" signal needs no new API call — either remove it or correct it to note that
   `reasons` isn't currently returned by `/api/client/dashboard`, deferring to the correct,
   already-present "Trigger condition, precisely" paragraph as the sole source of truth.

These are all additive clarifications to the existing document, not a restructure — I'd expect
this to be a quick pass for the Planner.

---

## Round 2 — Post-revision check

1. **Addressed.** Section 6 now opens with an explicit "Scope boundary — what's droppable if
   time runs short" paragraph naming SMS reminders (feature 3, step 8) as the one deferrable
   item, with the same rationale (highest complexity, no `ALLOW_ADMIN_LOGIN`-style stub for
   external SMS credentials) as requested.
2. **Addressed.** Section 5's enforcement checklist now names `PATCH /api/client/branding`
   explicitly as "also the route that *persists* a chosen slug, not just the display branding
   fields," and separately clarifies `GET /api/client/slug-available` is read-only and not the
   sensitive endpoint. Section 4 feature 2 repeats the same clarification.
3. **Addressed.** Both Section 4 (feature 2) and Section 5 now state directly that the
   3–30 char lowercase+hyphen slug format makes a slug/UUID collision structurally impossible
   (a 36-char canonical UUID can never match that format), so no cross-column constraint is
   needed and a plain `UNIQUE` index on `slug` alone suffices — the unresolved-sounding
   "needs a constraint" language is gone.
4. **Addressed.** Section 4 feature 3 and Section 5's SMS bullet both now specify
   per-appointment (or at minimum per-client) try/catch isolation and explicitly call out that
   this must *not* mirror `exportMonthlyCSVForAllClients`'s unguarded loop.
5. **Addressed.** Section 4 feature 2 has a new "*Downgrade behavior*" paragraph: a
   premium-only slug stops resolving on downgrade (checked at resolution time via
   `lib/resolve-client-link.ts`, not cached) while the slug value itself is retained in the DB
   so it resumes working immediately on re-upgrade — a clear, specific choice consistent with
   branding's degrade posture.
6. **Addressed.** The erroneous "cheap, already-fetched signal — no new API call needed"
   paragraph has been removed outright (confirmed via search — no trace remains); Section 3
   now contains only the single, correct "Trigger condition, precisely" paragraph
   (`tutorialCompletedAt === null`, independent of rules/reasons state) as the sole source of
   truth.

No new issues introduced by the revisions — the changes are additive clarifications exactly as
scoped, and spot-checking them against the surrounding text found no new factual errors or
inconsistencies.

**Final verdict: APPROVED — ready for Executor**

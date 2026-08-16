# Gather — ELITE Tier Proposal: Multi-Calendar & Team Access

**Prepared:** 2026-08-16
**Scope:** Two proposed ELITE-tier features for the Gather scheduling app — (1) multiple
booking calendars per client account, and (2) shared dashboard access for other emails.
Grounded in the current codebase (`clients.tier` = `free`/`premium`, Stripe-backed, plus the
`premium_grants` comp allowlist) and the existing single-calendar, single-login architecture.

**Assumptions made below** (nothing in the repo currently sets these, so flag before building):
Premium is priced at an illustrative **$29/mo** for comparison purposes only — no Stripe price
is actually configured yet (checked `lib/stripe.ts`, the `0009_stripe_billing` migration, and
the README; only infra costs, ~$7–70/mo, are documented). Team-access permissions are scoped
to the *whole* dashboard (viewer/editor), not per-calendar — the more granular per-calendar
scoping is noted as a natural follow-on once multi-calendar ships.

---

## Why these two together

Right now `clients` is one row that does five jobs at once: login identity, billing/tier,
branding, the public booking link, and the owner of every rule/reason/appointment. Both
proposed features break that assumption in different ways — multi-calendar splits "one
client" into "one account, many bookable calendars"; team access splits "one login" into "one
account, many logins." They don't depend on each other technically, but they compound in
value: a multi-location business or a church with several pastors needs *both* — separate
calendars per location/person, and staff who can help manage them without being handed the
owner's personal Google login.

---

## Feature 1: Multiple Calendars per Client

### What it enables

A client selects between several independently configured "booking calendars" from their
dashboard. Each one gets its own rules (hours, first-n, max-concurrent), its own branding
(display name, accent color, logo), its own visitor-facing link, and its own Google Calendar
selection to poll for conflicts. One login, several storefronts — e.g. a church with a
"Pastoral Counseling" calendar and a "Building Reservations" calendar, or a multi-practitioner
office with one calendar per provider.

### What has to change

This is the bigger of the two builds, because `client_id` is currently the scoping key on
almost everything. A new `booking_calendars` table (named to avoid clashing with the existing
"Google Calendar" terminology already in `lib/google-calendar.ts`) becomes the new owner of:

- `rules`, `appointment_reasons`, `appointments`, `error_log`, `csv_exports` — their FK moves
  from `client_id` to `calendar_id`. `clients` stays the auth/billing identity; a client can
  own many calendar rows.
- Branding fields (`display_name`, `accent_color`, `logo_url`) and `slug` move from `clients`
  to `booking_calendars` — each calendar gets its own look and its own link, not the account.
- `google_calendar_id` (added in migration 0011 for exactly this kind of per-calendar
  selection) moves the same way — each booking calendar polls a different real Google
  Calendar, using the one refresh token already stored on `clients`.
- The public link changes from *client*-scoped to *calendar*-scoped. `lib/resolve-client-link.ts`
  becomes `resolveCalendarLink()`, resolving a `booking_calendars` row instead of a `clients`
  row (same UUID-or-slug logic, same "slug only resolves at premium+" gate).
- The two Postgres functions that prevent double-booking (`book_appointment`,
  `update_appointment`) currently lock and enforce uniqueness on
  `(client_id, start_time, end_time)`. That predicate has to become `(calendar_id, start_time,
  end_time)` — this is the highest-risk part of the migration, since it's the exact mechanism
  that stops two visitors booking the same slot. It needs real integration test coverage, not
  just the existing pure-function tests in `lib/availability.test.ts` (which deliberately never
  touch the DB, by design).
- The Google-sync cron (`app/api/cron/google-sync`) currently does one sync per client; it
  moves to one sync per calendar. A client with 5 calendars means 5x the Google API calls for
  that client — worth a quota check once real usage exists, not a launch blocker.
- Dashboard UI: a calendar switcher (top of nav, next to or replacing the current single-tenant
  assumption), a "Manage calendars" page to create/rename/delete calendars and see which plan
  limit applies, and every existing page (Rules, Reasons, Schedule, Branding, Errors, Export,
  Analytics) now operates on "whichever calendar is currently selected" instead of implicitly
  "the client."

**Migration detail worth calling out:** give the auto-created "first" `booking_calendars` row
the *same UUID* as the client's existing `id` (and copy over its existing slug) when this
ships. That means every already-shared `/visit/[link]` a premium client has handed out keeps
working with zero visitor-facing disruption — the alternative (new random ids for everyone)
would silently break every link already printed on a business card or pinned in an email
signature.

### Cost

| Area | Effort | Why |
|---|---|---|
| Schema migration (new table + 5 FK moves) | Medium | Mechanical but touches almost every table |
| Booking-function rewrite + test | Medium–High | Highest risk item — it's the anti-double-booking guarantee |
| API route updates (~15 routes read `client.clientId` today) | Medium | Each needs a `calendarId` added and validated against the caller's own calendars |
| Dashboard UI (switcher + calendar management page) | Medium | New page + nav change touching every existing dashboard screen |
| Cron/Google-sync scaling | Small | Same logic, just looped per-calendar instead of per-client |
| Regression testing | Medium–High | Booking concurrency, branding-per-link, slug resolution all need re-verification |

Given how this project has actually shipped so far (each prior "phase" — full dashboard,
Stripe billing, premium comps, calendar selection — landed in roughly a day of focused
Claude-Code-assisted building per the architecture log), this reads as **the largest single
feature added since Phase 3**, closer in scope to Phase 2+3 combined than to any one of the
recent single-migration additions (0010, 0011). The dominant cost isn't writing the code, it's
verifying the booking-concurrency change doesn't regress — that deserves its own dedicated
test pass before ship.

### Benefit

Multi-location and multi-practitioner businesses are a real, common booking-app buying
segment, and right now Gather structurally can't serve them — a second calendar today means a
second Google login and a second client account, with no shared billing or branding
consistency. This closes that gap and is a genuine tier differentiator (competitors like
Calendly and Acuity gate "multiple booking pages/event types under one account" behind their
own upper tiers, so there's market precedent for charging more for it). It also raises the
ceiling on revenue per account — an Elite client managing 4 calendars is worth meaningfully
more than a Premium client managing 1, which changes the growth math (fewer total accounts
needed for the same revenue, and multi-calendar clients are stickier since more of their
business depends on Gather).

### Suggested limits

Free/Premium stay at 1 calendar (today's behavior, unchanged). Elite unlocks a small included
number (e.g. 3–5) with either a hard cap or a per-extra-calendar add-on price — cleaner to
launch with a hard cap and add metered pricing later once there's real usage data on how many
calendars clients actually want.

---

## Feature 2: Shared Dashboard Access (Read / Read-Write for Other Emails)

### What it enables

A client invites another email address into their dashboard with either **Viewer** (read-only)
or **Editor** (can create/edit rules, reasons, respond to errors, edit appointments) access,
without sharing their own Google login. Solves a real, current gap: today the *only* way a
client's office admin or a second staff member can help manage bookings is by literally
sharing the owner's Google account credentials — a real security anti-pattern this directly
fixes.

### What has to change

This is the smaller and lower-risk of the two features, because almost every route already
funnels through one function.

- New `client_collaborators` table: `id`, `client_id` (the owner being granted access to),
  `email` (invitee, lowercased — same convention as `premium_grants`), `role`
  (`'viewer' | 'editor'`), `invited_at`, `accepted_at`, `invited_by`. RLS enabled,
  service-role-only, same posture as every other table (and worth remembering the 0005
  lesson — grant `service_role` explicitly in the migration, don't assume it's inherited).
- `lib/auth.ts`'s `signIn`/`session` callbacks need new logic: when a signing-in email has no
  own `clients` row but *does* match a pending or accepted `client_collaborators.email`,
  resolve the session to the **owner's** `clientId` instead of creating a new independent
  client account, and attach `role` (plus `isCollaborator: true`) to the session.
- `lib/require-client.ts`'s return type grows a `role` field. Every write route
  (`PATCH`/`DELETE` on rules, reasons, appointments, branding, calendar settings) adds a
  `role !== 'viewer'` check. Billing, team management itself, and account/calendar deletion
  stay **owner-only** even for an Editor — read/write access to bookings isn't the same thing
  as access to the Stripe portal or the ability to revoke other collaborators.
- New `/dashboard/team` page (Elite-gated, upsell panel otherwise, matching the existing
  Branding-page pattern for locked features) plus `app/api/client/team/*` routes:
  `GET` (list current collaborators + pending invites), `POST` (invite), `PATCH` (change role),
  `DELETE` (revoke).
- Invite email via Resend (already integrated for confirmations) — not strictly required for
  security, since real auth is still Google OAuth, but it (a) confirms the email address isn't
  a typo before granting standing access, and (b) gives the invitee a discoverable "someone
  invited you" moment rather than silently landing in a stranger's dashboard next time they
  sign in.

### Workflow & UI

1. Owner opens the new **Team** page in the dashboard sidebar (next to Billing) — Elite-gated
   like Branding is Premium-gated today.
2. Owner enters an email, picks **Viewer** or **Editor**, clicks **Send Invite**. A
   `client_collaborators` row is created (`accepted_at: null`), and Resend sends the invitee an
   email: *"[Client name] invited you to help manage their Gather dashboard as a [Viewer /
   Editor]. Click to accept."* The link just routes them to the normal `/dashboard` sign-in —
   there's no separate invite-token auth path to build, since Google OAuth is still doing all
   the actual authentication.
3. Invitee clicks **Continue with Google** exactly as any client would today. On sign-in, if
   their email matches a pending invite, `accepted_at` is stamped and their session resolves
   into the owner's account with the assigned role, instead of creating a new independent
   `clients` row.
4. Invitee lands on the same dashboard the owner sees. A small persistent banner reads
   *"Viewing [Owner]'s dashboard — Editor access"* so it's never ambiguous whose account is
   being edited. If that same person is later invited to a second client's dashboard, or has
   their own separate Gather account, a lightweight switcher lets them move between contexts
   (same shape as the calendar switcher in Feature 1, if both ship).
5. **Viewer** role: every page renders read-only — no save/delete buttons on Rules, Reasons,
   Branding; "Retry Sync" on Errors disabled; Billing and Team pages hidden entirely.
   **Editor** role: full read/write on bookings-related pages, but Billing and Team management
   stay owner-only, and account/calendar deletion is never available to a collaborator.
6. Owner's Team page lists active collaborators (with role, "invited X days ago") and pending
   invites, with a **Revoke** action per row. Revoking deletes the row — the collaborator's next
   session refresh either 401s them out of that account or, if they have their own separate
   `clients` row, drops them back into their own account normally.

### Cost

Meaningfully smaller than Feature 1. The write-side authorization change is centralized
(`requireClient()` already gates every route), so most of the work is: one new table, the
auth-callback branch, a role check sprinkled across existing write routes, one new dashboard
page, and four small API routes. No schema change touches booking concurrency, no public-link
resolution logic changes, no cron changes. Realistically a **Small–Medium** build relative to
Feature 1's Medium–High — a reasonable candidate to ship first.

### Benefit

Directly removes a live security anti-pattern (credential sharing) that's already the *de
facto* workaround for any client who wants help managing bookings. Also a natural Elite
differentiator with low support burden once built — "who can see/edit my dashboard" is a
one-time setup a client does once, not an ongoing feature they need hand-holding on. Pairs
well with Feature 1: a multi-calendar client is exactly the kind of account (multiple
locations/providers) likely to also want to delegate day-to-day schedule management to staff
per-calendar down the line.

---

## Combined cost/benefit summary

| | Multi-Calendar | Team Access |
|---|---|---|
| Relative build cost | Medium–High | Small–Medium |
| Primary risk | Booking-concurrency function change (double-booking guarantee) | Auth-callback correctness (must never leak one client's data into another's session) |
| Touches public visitor-facing URLs | Yes — link resolution moves from client to calendar | No |
| Touches billing/tier logic | Yes — new plan limit (calendar count) | Yes — new plan limit (collaborator count), Elite-gated page |
| Business case | Serves multi-location/multi-provider clients Gather can't serve today; raises revenue ceiling per account | Removes a real security anti-pattern (owner sharing Google credentials); low ongoing support cost once built |
| Suggested sequencing | **Second** — bigger, riskier, benefits from Feature 2's role model already existing | **First** — smaller, lower-risk, and its role system becomes the natural place to later add per-calendar scoping |

**Recommended sequencing:** ship Team Access first. It's the smaller, lower-risk change, it
plugs an existing pain point (credential sharing) that has nothing to do with multi-calendar,
and its owner/editor/viewer role model is one that Multi-Calendar can later extend to
per-calendar scoping ("Editor on the Counseling calendar only") rather than building role logic
twice. Ship Multi-Calendar second, budgeted as its own milestone given the booking-function
risk, with a dedicated regression/integration test pass on `book_appointment` /
`update_appointment` before it goes live.

---

## Open questions to settle before scoping either as a real Elite tier

1. **Elite pricing** — needs a real number; nothing is configured in Stripe yet, so this
   proposal used $29/mo Premium as an illustrative anchor only.
2. **Calendar/seat limits** — hard cap vs. metered add-on pricing for calendars beyond the
   included Elite allotment, and collaborators beyond the included seat count.
3. **Permission granularity** — this proposal scopes Team Access to the whole dashboard
   (Viewer/Editor). Per-calendar scoping is a natural v2 once Feature 1 exists, but adds real
   complexity (a collaborator's role would need to vary by calendar) — worth deciding now
   whether that's ever a requirement, since it affects the `client_collaborators` schema shape
   (a single `role` column today vs. a `(calendar_id, role)` join table later).

# Final Review — `improve/ui-premium-tier`

Reviewer pass grading the actual shipped code (all changes are uncommitted working-tree
modifications + untracked new files — no commits exist on this branch beyond `main`, so `git
diff HEAD` was used instead of a commit-range diff). 23 modified files, ~13 new files, one new
migration (`0007_client_onboarding_and_tier.sql`).

---

## Overall grades

### Complexity — **Adequate**

The shipped surface roughly matches PLAN.md's scope: schema migration, session/tier plumbing,
11 UI fixes, reasons delete/rename, onboarding tour, branding+slug, analytics, and an honestly
stubbed SMS cron. Nothing ballooned into unrequested infrastructure — analytics aggregates in
plain JS instead of adding a charting library or SQL views, branding re-themes only the
highest-visibility elements via inline styles instead of a full Tailwind CSS-variable re-theme.
Both are documented as deliberate scope calls rather than corners quietly cut. The SMS feature
is genuinely half-finished (`lib/sms.ts#sendSms` always throws), but this is the one place
PLAN.md explicitly pre-authorized stopping short, and the code is honest about it in-line —
this is a deferred feature presented as deferred, not as done. The reasons-create route has a
minor unhandled TOCTOU (check-then-insert instead of relying solely on the unique constraint),
a small blemish, not a design problem.

### Security — **Strong**

Every premium-gated route enforces `tier === 'premium'` server-side, independent of the UI:
`PATCH /api/client/branding` (`app/api/client/branding/route.ts:34-36`), `GET
/api/client/analytics` (`app/api/client/analytics/route.ts:37-39`), and the SMS cron's DB-level
query filter (`app/api/cron/sms-reminders/route.ts:44-48`, no session to gate so it filters at
query time as the plan required). `tier` is never accepted as request input anywhere — grepped
every file touching `tier`; it is only ever read from `session`/`requireClient()`/the `clients`
row, and `require-client.ts` fails closed (`tier` defaults to `'free'` if absent from session,
`app/api/client/dashboard`'s `clientRow.tier` comes straight off a `NOT NULL DEFAULT 'free'`
column). `lib/resolve-client-link.ts` checks the slug's owning client's tier fresh on every
call (not cached), and a slug/UUID collision is structurally prevented by validation, not by a
runtime check — the UUID-shape regex is tried first and slugs can never match it. `logoUrl` is
restricted to `https://` at the zod layer and rendered only via `<img src>`, never
`dangerouslySetInnerHTML`. Error responses on visitor-facing routes route through
`errorResponse()` and never leak raw Postgres detail (confirmed on `book/route.ts`,
`branding/route.ts`, `reasons/[id]/route.ts`). The one gap: the reasons-create race noted above
would leak a raw-ish generic 500 (not real DB detail — `errorResponse()` still normalizes it)
instead of a friendly 409 on a very narrow double-submit race — cosmetic, not a security hole.

### Earnings/Feature potential — **Strong**

The four premium features solve a coherent story: branding + custom slug make the booking page
look and feel like the client's own business (the plan's stated best "why pay" pitch), and
analytics turns the app into a business tool. Free tier still gets a fully functional booking
system; premium tier is additive, not a paywall that breaks core function. The free/premium
split is visible and consistent in the live UI — `DashboardNav` always shows Branding/Analytics
with a "Premium" badge for free clients (a reasonable, documented deviation from a literal
reading of "teaser/locked card instead of the link" — the actual data-access gate is still
100% server-side either way), and both premium pages render a genuine locked/upsell panel
rather than an error page when accessed by a free client. SMS reminders — the single highest
"obviously worth paying for" feature per the plan's own ranking — is not functional yet; that's
the one real gap between "premium tier" as pitched and what a client could actually be charged
for today.

---

## Verified claims (re-checked myself, not just read from EXECUTION_LOG)

- `npx tsc --noEmit` — clean, exit 0.
- `npm run lint` — "No ESLint warnings or errors."
- `npm test` — 2 files / 10 tests passed.
- `npm run build` — compiled successfully, all 27 routes generated including every new one
  (`/api/client/analytics`, `/api/client/branding`, `/api/client/slug-available`,
  `/api/client/reasons/[id]`, `/api/client/onboarding/complete`, `/api/cron/sms-reminders`,
  `/dashboard/analytics`, `/dashboard/branding`).
- Migration `0007` — read in full; additive only, matches EXECUTION_LOG's column list exactly,
  partial unique index on `slug` (not a plain column constraint), no destructive changes.
- `lib/resolve-client-link.ts` — read in full; slug resolution checks `tier = 'premium'` fresh
  per call, UUID-shape checked first, format makes collision structurally impossible.
- `PATCH /api/client/branding` — confirmed the `tier !== 'premium'` → 403 check happens before
  any DB write, and the slug write path goes through the same check (not a separate,
  unguarded endpoint).
- `GET /api/client/analytics` — confirmed 403 gate; confirmed it aggregates server-side and
  never ships raw appointment rows.
- SMS cron — confirmed real `requireCron()` gate, real two-step tier+opt-in query, real
  per-appointment `try/catch` (does not repeat `exportMonthlyCSVForAllClients`'s unguarded-loop
  bug), and confirmed `lib/sms.ts#sendSms` unconditionally throws — the "stubbed, not real"
  claim is accurate, not just asserted.
- Grepped every file referencing `tier` — confirmed no route/schema accepts it as client input.
- Spot-checked `Modal.tsx` (focus trap/Escape/focus-return), `Calendar.tsx` (aria-labels),
  `rules/page.tsx` (grouping/explainer text), `DashboardNav.tsx` (Setup/Operate/Premium
  grouping + badge) — all present and match the log's description, not just claimed.

## Bugs / gaps found

1. **Low** — `app/api/client/reasons/route.ts` `POST`: existence check then `insert` is a
   check-then-act race (two concurrent creates with the same name could both pass the
   pre-check and one would hit the `UNIQUE(client_id, name)` constraint raw, falling through to
   the generic `errorResponse()` 500 path instead of the friendly 409 the `PATCH` route gets via
   its own `23505` catch). Not a security issue — no data leaks, no cross-tenant exposure — just
   a worse error message on a narrow double-submit. Easy fix: wrap the `insert` in the same
   `23505` catch already used in `reasons/[id]/route.ts`.
2. **Informational** — SMS reminders are non-functional by design (`lib/sms.ts` always throws).
   Correctly disclosed everywhere (route comment, `.env.example`, EXECUTION_LOG, and the
   Branding page's own checkbox copy: "Not yet live in this deployment"). Not a defect, just the
   one incomplete premium feature — flagging so it isn't missed when deciding what a premium
   client is actually being sold today.
3. **Informational** — Migration `0007` has not been applied to any live Supabase project (per
   EXECUTION_LOG, confirmed no `db:migrate` was run). Every new column-dependent route will
   fail against an unmigrated live DB. This is an explicit, disclosed "outstanding action for
   the user" item, not a code defect.

No correctness, complexity, or security issues rise above "low/informational" — nothing here
would block a client-facing deploy on its own merits (modulo item 3, which is an operational
step, not a code fix).

## Bottom line

**Fit to hand to the user for their own review.** This is a clean, well-scoped pass: server-side
tier enforcement is real and consistent everywhere it needs to be, the slug-resolution
collision risk the plan worried about is closed by construction (format-level, not a runtime
check that could regress), `tier` is never trusted from client input, and the verification
claims in EXECUTION_LOG check out against independently re-run `tsc`/`lint`/`test`/`build`. The
SMS feature is the only incomplete piece, and it was incomplete by the plan's own explicit
permission and is honestly labeled as such rather than dressed up as done.

**Punch list before/alongside handoff:**

Critical (block nothing, but do before calling premium "done"):
- None. Nothing here is unsafe to ship as-is.

Nice-to-have (small, low-risk follow-ups):
1. Wrap the `insert` in `app/api/client/reasons/route.ts` `POST` in a `23505` catch (mirror
   `reasons/[id]/route.ts`'s pattern) to close the double-submit race with a friendly message.
2. Run `npm run db:migrate` (or apply `0007` by hand) against the target Supabase project before
   any of this pass is usable end-to-end — currently a manual step, not a code gap.
3. When ready to make SMS reminders real, implement `lib/sms.ts#sendSms` against a chosen
   provider (Twilio or otherwise) — no other file needs to change per the code's own header
   comment.
4. Live browser click-through (onboarding tour, Branding, Analytics, the rewritten visitor
   flow, touch-accessible `AppointmentCard`) is still unverified in an actual browser, per both
   PLAN.md and EXECUTION_LOG's own disclosed gap — worth doing before wide rollout, though
   nothing found in static review suggests it will surface a functional problem.

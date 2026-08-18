# L9 — Pre-flight

**Est:** 2h. Run this last, on the real machine, against the real deployment.

## Verify the toolchain

Every previous audit of this repo has been done in a Linux sandbox against Windows-installed
`node_modules`, so `npm test` and `npm run build` have gone unverified round after round. Run
them here, on your machine:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
npm run test:integration   # needs Docker + local Supabase CLI stack
```

`test:integration` is the one that matters most — `tests/integration/booking-concurrency.test.ts`
is the only thing that proves the claim the marketing page's `ConflictDemo` makes. If it can't
run, say so out loud rather than quietly skipping it.

## Screenshots

`scripts/design-shots.mjs` (from the Nightshift harness) walks the routes at 1280x900 and
375x812. Add `/privacy`, `/terms`, `/manage/[token]`, and the new onboarding timezone step.
**Look at them.** Capturing and not reading is not verification.

## Correctness sweep

- [ ] Marketing page prices match the Stripe Prices exactly. A mismatch here is a chargeback.
- [ ] Every tier gate enforced server-side, not just hidden in nav: branding, analytics,
      reminders, calendars, **team** (L2), custom slug
- [ ] `ALLOW_ADMIN_LOGIN` absent from Render — then confirm `/api/client/dev-tier-toggle`
      returns 404 on the live site, and that the admin credentials login is not offered
- [ ] Migrations 0001–0021 applied in order to production; `0016` ran against a backup
- [ ] `NEXTAUTH_URL`, redirect URI, and `EMAIL_FROM_ADDRESS` all on gathertime.com
- [ ] The four cron endpoints reject a request with a wrong `x-cron-secret`
- [ ] Booking a slot that's busy on Google is not offered in the first place
- [ ] A booked appointment's Google event is at the correct wall-clock time in a non-UTC zone
- [ ] Confirmation email arrives from `@gathertime.com`, not sandbox

## Nightshift pre-flight

Re-run the "Every phase" checklist from `.design/` against every surface L1–L8 touched: zero
em-dashes in user-visible strings, focus ring on every interactive element, loading/empty/error
states all styled, `prefers-reduced-motion` honored, Phosphor icons only, `min-h-[100dvh]`.

## Then

Update `.launch/next-prompt.md` to say the code track is complete, and hand off to
`.launch/chrome/C5-smoke-test.md`.

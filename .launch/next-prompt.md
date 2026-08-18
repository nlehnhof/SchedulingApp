# Next up

**Code track (L1-L9) is complete.** All nine phases implemented in this repo:
privacy/terms pages, server-side team tier enforcement, onboarding timezone capture, marketing
pricing truth, a 14-day Premium trial + billing-page polish, account deletion/Google
disconnect, visitor-facing cancel/reschedule (`app/manage/[token]`), Sentry + `/api/health`,
and this preflight pass. `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build` are
all clean. `npm run test:integration` cannot run in this environment (no Docker/local Supabase
CLI stack) — run it for real before trusting the concurrency guarantee.

Two new migrations were added beyond `0021`: `0022_billing_period_and_trial.sql` and
`0023_visitor_management.sql`. Both need to run as part of YOU-10's migration pass.

**Hand off to `.launch/chrome/C5-smoke-test.md`** once the domain/Stripe/Supabase/Render setup
(`C1`-`C4`, and the "For You to Do" list in `.launch/LAUNCH.md`) is done — C5 is the live,
end-to-end verification this code-only pass couldn't do itself (real Google sign-in, real
Stripe payment, real Google Calendar write-back, real screenshots).

Do not commit unless asked.

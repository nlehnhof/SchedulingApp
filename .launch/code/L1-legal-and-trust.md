# L1 — Legal and trust surface

**Blocks:** Google OAuth verification, Stripe account activation. Nothing else can start
without this. Do it first.
**Est:** 2h

## Why

`find app -iname "*privacy*" -o -iname "*terms*"` returns nothing today. Google's
sensitive-scope verification requires a privacy policy hosted on the same verified domain as
the homepage and linked from it. Stripe requires terms and a refund policy to activate. The
footer in `app/page.tsx` currently has a wordmark, a CTA, and a copyright line with no links.

## Build

**`app/privacy/page.tsx`** and **`app/terms/page.tsx`**. Static server components, no
`'use client'`. Reuse the marketing shell: `MarketingNav`, the same `canvas`/`surface` tokens,
`max-w-3xl`, prose set in `body` with `display-sm` section headings. Add
`export const metadata` to each.

The privacy policy has to describe, accurately, what this app actually does:

- Account data for clients: email, name, and Google profile from OAuth; a Google refresh token
  stored to poll and write their calendar.
- Google Calendar data: the app reads events on the one calendar the client selects (±30 days)
  to compute busy time, and writes one event per booking. It does not read other calendars, and
  it does not sell, transfer, or use Google user data for advertising or to train models. Say
  this explicitly and in these terms — Google's reviewers look for it.
- Visitor data: name and phone, optionally email; collected on behalf of the client, retained
  until the client deletes the appointment or their account.
- Sub-processors, by name: Supabase (database, hosting region), Render (application hosting),
  Resend (transactional email), Stripe (payments), Google (calendar sync). Anything you add
  later — Sentry in L8 — goes in this list too.
- How to request deletion, pointing at the flow L6 builds, plus a contact address.

Terms need: what the service is, that it's provided as-is, acceptable use, that clients are
responsible for the data they collect from their own visitors, subscription billing terms
(monthly, auto-renewing, cancel any time, no partial-month refunds — state whatever you'll
actually honor), and termination.

Write both in plain language. Do not paste a generic SaaS template; half of it will describe
things this app doesn't do, and Google reads these.

**Footer** in `app/page.tsx`: add `Privacy` and `Terms` links and a real support address
(`support@gathertime.com`) to the legal line. Keep the existing wordmark and single CTA — the
Nightshift constraint is one CTA intent per page, so the links are text, not buttons.

Add the same three links to the dashboard's signed-out state in `app/dashboard/layout.tsx`.

## Done when

- [ ] `/privacy` and `/terms` render at 375px and 1280px, dark, on-token
- [ ] Both are reachable from the homepage footer in one click
- [ ] Privacy policy names every sub-processor and states the no-sale / no-ads / no-training
      commitment for Google user data
- [ ] Support email appears on the marketing footer
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

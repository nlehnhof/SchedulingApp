# L2 — Tier enforcement on team access

**Est:** 1h. **This is a live bug, not a feature.**

## Why

`app/api/client/team/route.ts` and `app/api/client/team/[id]/route.ts` check
`requireCalendarAccess` and `requireOwnerRole` and **never check tier**.
`app/dashboard/team/page.tsx` has no lock view either. The only thing gating Elite's headline
feature is `components/DashboardNav.tsx` hiding the link at `minTier: 'elite'`.

A free client who types `/dashboard/team` in the URL bar gets unlimited collaborators for
free. Compare `app/api/client/branding/route.ts:57`, `analytics/route.ts:45`,
`reminders/route.ts:44`, and `calendars/route.ts` — all of which enforce server-side.

## Build

**Seat model** (this is also a pricing change — see the pricing doc §2.2). Team access moves
down to Premium with a cap, because at one calendar and one seat, $19 Premium loses head-on to
Cal.com's free tier:

```
free:    0 collaborators
premium: 2 collaborators (3 people total, counting the owner)
elite:   unlimited
```

Put that in `lib/tier.ts` as `COLLABORATOR_LIMIT_BY_TIER`, next to `isAtLeast`, so
`app/api/client/calendars/route.ts`'s existing `CALENDAR_*_LIMIT_BY_TIER` pattern has a
sibling rather than a competitor.

**`POST /api/client/team`** — after `requireOwnerRole`, resolve the *calendar owner's*
effective tier (`calendarOwnerTier` in `lib/require-calendar.ts`, the same helper the analytics
route uses — never the requester's own tier, per `CLAUDE.md`'s note on this). Reject with 403
if the tier allows 0, and reject with 403 if the current accepted+pending count for that
calendar is already at the limit. Message should name the limit and the next tier up.

**`GET /api/client/team`** stays open to any owner — showing an empty list is fine and the
lock view needs to render.

**`PATCH /api/client/team/[id]`** — same gate. A downgraded client must not be able to promote
a viewer to editor.

**`app/dashboard/team/page.tsx`** — render `PremiumLockCard` when the tier allows 0
collaborators, matching `app/dashboard/branding/page.tsx:80`'s pattern. Show the seat count
against the limit ("2 of 2 seats used") when it's finite.

**Downgrade behavior.** Decide it and write it down in the file: existing collaborators above
the new limit are *retained but frozen* (they keep access; the owner can't add more until they
revoke some). Silently revoking access when a card expires is worse than the alternative.

**Tests.** `lib/tier.ts`'s new function is pure — add cases to a test file alongside
`brand-color.test.ts`. This repo tests pure functions.

## Done when

- [ ] `POST /api/client/team` returns 403 for a free-tier calendar owner
- [ ] Premium owner can add 2 and is refused the 3rd with a message naming Elite
- [ ] `PATCH` is gated identically
- [ ] `/dashboard/team` shows a lock card on free, a seat counter on premium
- [ ] Downgrade path documented in the route header comment
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

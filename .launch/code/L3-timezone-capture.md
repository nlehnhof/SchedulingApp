# L3 — Capture a real timezone at signup

**Est:** 2h. **Most likely thing to burn your first ten unattended signups.**

## Why

`booking_calendars.timezone` defaults to `'UTC'` (`0014_booking_calendars.sql:21`) and nothing
ever populates it. `lib/auth.ts`'s signIn callback creates a brand-new client's first calendar
with only `{ id, client_id }`. Every Google write-back is tagged
`timeZone: calendar.timezone || 'UTC'` (`lib/booking.ts:115`).

Net effect for a self-serve signup in Denver who never visits `/dashboard/calendar`: a 9:00 a.m.
appointment lands on their Google Calendar at 3:00 a.m. Silently. `lib/google-calendar.ts`'s
`eventBody` comment already describes this exact failure — it's currently the default state for
every new account.

## Build

Server-side detection isn't reliable (the app runs on Render in UTC), so read it from the
browser: `Intl.DateTimeFormat().resolvedOptions().timeZone`.

**Preferred: fold it into onboarding.** `components/OnboardingTour.tsx` already runs on first
login and `app/api/client/onboarding/complete/route.ts` already writes
`tutorial_completed_at`. Add a first step that shows the detected zone, lets the client change
it from a select, and PATCHes `/api/client/calendar?calendarId=...` with `{ timezone }` — that
route and its zod validator (`lib/validation.ts:186`) already accept exactly this.

Make it non-skippable. It's one click if the detection is right, which it will be almost always.

**Backstop for accounts that predate this:** show a dismissible-but-persistent banner on the
dashboard when the selected calendar's timezone is still `'UTC'` *and* the browser reports
something else. Reuse `ErrorBanner`'s shape but in a neutral/warning tone, not `rose`.

**New calendars.** `POST /api/client/calendars` (Elite, multi-calendar) inserts with only
`display_name`. Have the client-side create form send the browser's zone too, so calendar #2
doesn't reintroduce the bug.

**Don't** try to change the app's naive-wall-clock model. `lib/date-format.ts`'s header
explains why appointment times are naive everywhere; `timezone` exists only to label writes to
Google. Widening this phase into a timezone refactor is how it eats a week.

## Done when

- [ ] A brand-new Google signup cannot reach the dashboard without a timezone set
- [ ] The detected zone is correct for a browser set to America/Denver
- [ ] An existing UTC-defaulted account sees the banner
- [ ] A second calendar created on Elite inherits a real zone, not `'UTC'`
- [ ] Manual check: book an appointment, confirm the Google event lands at the same wall-clock
      time shown in the dashboard
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

# C5 — Live smoke test

**Runs after:** everything. Google verification has cleared, the domain is live, Stripe is in
live mode.

Read `.launch/chrome/README.md` first. Record the whole run with `gif_creator` — it's the
artifact you'll want when something breaks in week two, and it's most of a demo video.

Use a **second Google account** that has never touched this app, in a clean profile. Testing
with your own comped account (`premium_grants` seeds `n.lehnhof01@gmail.com`) hides exactly the
free-tier bugs a stranger will hit first.

## The run

1. **Marketing page.** Loads at 375px and 1280px. Prices visible. Privacy and Terms both open.
2. **Sign in.** Consent screen shows two Calendar permissions and **no unverified-app warning**.
   If the warning appears, verification hasn't actually cleared — stop here.
3. **Onboarding.** Timezone step appears and detects correctly (L3).
4. **Free-tier limits.** Try to reach `/dashboard/branding`, `/dashboard/analytics`,
   `/dashboard/team`, `/dashboard/calendars` by typing the URLs directly. Every one must show a
   lock, not a working page. Then `POST /api/client/team` from the console with a real
   `calendarId` — must be 403, not 200. **This is the bug L2 fixed; verify it stayed fixed.**
5. **Set up a calendar.** Pick a real Google calendar, add an availability rule, add a reason.
6. **Book as a visitor.** Open the booking link in an incognito window. Book with name and
   phone only, no email. Confirm:
   - the slot disappears for a second visitor
   - a time already busy on the Google calendar is never offered
   - the appointment appears on Google Calendar **at the right wall-clock hour**
   - the manage link works (L7), and cancelling removes the Google event
7. **Pay.** Upgrade to Premium with a **real card**. Confirm the trial, then confirm the tier
   flips to premium. Check the Stripe webhook delivery log shows a 200.
8. **Premium features.** Custom slug resolves. Branding accent applies to the visitor page.
   Analytics loads. Confirmation email arrives from `@gathertime.com`, to a non-Gmail address,
   not in spam.
9. **Cancel** in the portal. Tier returns to free, premium pages lock, the custom slug stops
   resolving.
10. **Delete the account** (L6). Verify in Supabase that the rows are gone and in Stripe that
    the subscription is cancelled. Confirm the app is gone from that Google account's
    third-party access list.

## If anything fails

Don't fix it in the browser. Write it down, and take it back to the code track as a new phase
file. The point of this session is to find things, not to patch them live.

## Done when

- [ ] All ten steps pass on a clean second account
- [ ] The `POST /api/client/team` 403 confirmed by hand
- [ ] The Google event's wall-clock time is correct in a non-UTC timezone
- [ ] Every item in `.launch/LAUNCH.md`'s Definition of done is ticked

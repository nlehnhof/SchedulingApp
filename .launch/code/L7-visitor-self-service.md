# L7 — Visitor cancel and reschedule

**Est:** 4h. **The one phase worth cutting if time runs out.** Everything above it is either
a blocker or an hour.

## Why

`app/api/visitor/[clientLink]/` is availability, book, and reasons — there is no cancel and no
reschedule. Every competitor puts both in the confirmation email. Each one Gather doesn't send
becomes a phone call to your customer, which they will notice and resent.

This is awkward *because* of the product's own differentiator: a visitor with no account and
no required email has nowhere to receive a management link.

## Build

**A signed, single-appointment token.** HMAC over `appointment.id` with `NEXTAUTH_SECRET` (or
its own `APPOINTMENT_TOKEN_SECRET`), compared with `lib/safe-compare.ts`'s constant-time
compare — the same shape as `lib/require-cron.ts`. Stateless, no new table, no expiry needed
beyond the appointment's own start time.

Route: `app/manage/[token]/page.tsx`, resolving to one appointment. Show what's booked, and two
actions.

**Delivery, in priority order:**
1. On the step-4 confirmation screen, always. A visitor with no email still gets the link, and
   can screenshot or bookmark it. This alone covers most of the value.
2. In the confirmation email when `visitor_email` was captured (`0008` migration).
3. Nothing else. Do not require email to book — that's differentiator (B) in the strategy doc
   and it is not negotiable for this.

**Cancel** — reuse the existing `DELETE /api/client/appointments/[id]` path so the Google
write-back deletion (`deleteGoogleCalendarEvent`) and error-log behavior stay in one place.
Factor the shared body out of the client route rather than duplicating it.

**Reschedule** — must go through `update_appointment`, the Postgres function, not a plain
UPDATE. `CLAUDE.md`: this and `book_appointment` are the highest-risk logic in the app and a
reschedule has exactly the same race condition as a fresh booking. Do not touch either
function; just call it.

**Client-side control.** Some clients won't want visitors cancelling freely. Add a per-calendar
`allow_visitor_management` boolean (new migration, default `true`) and a minimum-notice check —
reuse the existing `min_notice` rule rather than inventing a second one.

**Rate limit** the token routes with `lib/rate-limit.ts`, same as the booking endpoint.

## Done when

- [ ] The confirmation screen shows a working manage link for a visitor who gave no email
- [ ] A tampered token is rejected, and rejection is constant-time
- [ ] Cancelling removes the Google event
- [ ] Rescheduling into a taken slot loses cleanly with the existing conflict copy
- [ ] Two simultaneous reschedules into the same slot: one wins (this is the whole guarantee)
- [ ] A calendar with `allow_visitor_management=false` shows a "contact them directly" message
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

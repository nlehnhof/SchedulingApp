# L6 — Account deletion and Google disconnect

**Est:** 2h. Google's verification review asks about this.

## Why

There is no way for a client to delete their account or revoke the app's Google access.
`grep "from('clients')" | grep -i delete` returns nothing. A self-serve product needs it, the
privacy policy L1 writes will promise it, and Google asks.

## Build

**`DELETE /api/client/account`.** Owner only (`client.clientId` must be set — a pure
collaborator has no account to delete, same guard as
`app/api/client/billing/checkout/route.ts:26`). In order:

1. Cancel any live Stripe subscription (`stripe.subscriptions.cancel`), best-effort — log and
   continue on failure, same pattern as the calendar write-back. A deleted account that keeps
   billing is much worse than a failed cancel that gets caught by hand.
2. Revoke the Google refresh token: `POST https://oauth2.googleapis.com/revoke?token=...`.
   Best-effort; a 400 means it was already revoked.
3. Delete the `clients` row and let the existing foreign keys cascade
   (`booking_calendars` → rules, reasons, appointments, error_log, collaborators). **Verify the
   cascade actually exists** in `0001_init.sql` and `0014`–`0018` before relying on it; if any
   FK is `ON DELETE NO ACTION`, delete explicitly in dependency order instead of assuming.
4. Sign the session out.

**Separate, smaller action: "Disconnect Google."** Clears `google_refresh_token` and revokes,
without deleting anything. Sync stops, existing appointments stay. Some clients want this and
it's most of the same code.

**UI.** A "Danger zone" section at the bottom of `app/dashboard/billing/page.tsx` (it's already
the account page in spirit). Inline confirmation, not a native `confirm()` — this repo uses
non-native confirmation everywhere else, see `AppointmentCard`. Require typing the account
email to confirm. State plainly what is destroyed and that it can't be undone.

**Visitor-facing consequence.** Deleting an account kills live booking links. Say so in the
confirmation copy.

## Done when

- [ ] Deleting a test account removes every row across all tables (verify in Supabase)
- [ ] The Stripe subscription is cancelled, verified in the Stripe dashboard
- [ ] The app disappears from the account's Google third-party access list
- [ ] The booking link 404s cleanly afterwards, not with a 500
- [ ] Disconnect-Google leaves appointments intact and stops sync
- [ ] Privacy policy's deletion section matches what this actually does
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

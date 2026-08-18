# L5 — Billing polish

**Est:** 1.5h

## Why

The checkout flow is structurally correct — `tier` is written in exactly one place
(`app/api/stripe/webhook/route.ts`), existing subscribers are routed to the portal rather than
a second checkout, and `tierFromSubscription` derives tier from the Price rather than from
status. What's missing is everything that makes a stranger convert.

## Build

**14-day trial on Premium.** In `app/api/client/billing/checkout/route.ts`, add
`subscription_data: { trial_period_days: 14 }` to the `checkout.sessions.create` call. Highest
leverage 15 minutes in the whole plan: Cal.com is free and Acuity gives 7 days, so launching
self-serve with no trial is a losing setup.

Trial on Premium only, not Elite — Elite buyers are talking to you anyway.

Check the webhook handles it: `trialing` is already in `tierFromSubscription`'s allowed status
list, so a trialing customer gets their tier immediately. Confirm a trial that ends without a
card produces `customer.subscription.deleted` or an `updated` with a non-active status, and
that the downgrade lands.

**Billing page copy.** `app/dashboard/billing/page.tsx` currently shows tier and status with no
prices and no explanation. Add: what each tier costs, what the current subscription renews at
and when, "cancel any time" pointing at the portal, and — during a trial — days remaining.
`GET /api/client/billing` will need to return `stripe_subscription_status` (it does) plus the
current period end and trial end; add them to the select.

**Elite upgrade path.** `POST /api/client/billing/checkout` sends anyone already at premium+
to the billing portal regardless of `targetTier`. That's correct, but the UI should say so:
the Elite button on a Premium account should read "Change plan" and explain that the switch
happens in the portal, not "Upgrade to Elite" leading somewhere unexpected.

**Failure copy.** Checkout currently 400s with "Checkout for elite isn't configured yet." when
a Price id is unset. That's a good developer message and a terrible customer one. Log the real
reason, show the customer a generic "we couldn't start checkout, email support@gathertime.com".

**Do not build annual billing.** It needs a second Price per tier and a monthly/annual toggle
with its own state. Worth doing once someone has paid monthly; not on the critical path.

## Done when

- [ ] Test-mode checkout starts a 14-day trial and the account shows Premium immediately
- [ ] Cancelling during the trial downgrades to free via webhook
- [ ] Billing page shows price, renewal date, and trial days remaining
- [ ] Elite CTA on a Premium account is honest about going to the portal
- [ ] No Stripe env-var name is ever shown to a customer
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

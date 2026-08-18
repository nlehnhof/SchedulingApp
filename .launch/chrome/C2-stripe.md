# C2 — Stripe

**Runs after:** account activation is submitted (YOU-3). Test mode works before it clears.

Read `.launch/chrome/README.md` first. **Claude does not touch the secret key or the webhook
signing secret** — it navigates to them and stops.

## Part 1 — Test mode, and prove the loop works

Toggle to **Test mode**. Products → create three:

| Product | Price | Recurring | Env var |
|---|---|---|---|
| Gather Premium | $19.00 USD | monthly | `STRIPE_PREMIUM_PRICE_ID` |
| Gather Elite | $49.00 USD | monthly | `STRIPE_ELITE_PRICE_ID` |
| Extra booking calendar | $5.00 USD | monthly, **quantity-based** (usage type: licensed) | `STRIPE_ELITE_EXTRA_CALENDAR_PRICE_ID` |

Copy the three **Price** ids — `price_...`, not `prod_...`. `app/api/stripe/webhook/route.ts`
maps Price id → tier, so a Product id here means every paying customer silently lands on the
fallback tier.

No annual prices. That needs a monthly/annual toggle in the app that doesn't exist yet.

## Part 2 — Webhook

Developers → Webhooks → Add endpoint.
- URL: `https://gathertime.com/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`

The signing secret is a secret. Claude navigates there; **the user copies it into Render**.

For local testing, the user runs `stripe listen --forward-to localhost:3000/api/stripe/webhook`
and uses the secret it prints — that's already documented in `.env.example`.

## Part 3 — Customer portal

Settings → Billing → Customer portal. Turn on:
- Cancel subscription (immediately or at period end — pick one and make sure L5's copy matches)
- Update payment method
- Switch plans, with Premium and Elite both listed

`app/api/client/billing/checkout/route.ts` sends every existing subscriber here instead of a
second checkout, so a portal that can't switch plans means nobody can ever upgrade to Elite.

## Part 4 — Test the whole loop, in test mode

With test env vars set locally or on a preview deploy, using card `4242 4242 4242 4242`:

1. Free account → Upgrade → checkout completes → **tier flips to premium**. If it doesn't, the
   webhook isn't reaching the app; check the endpoint's delivery log in Stripe.
2. Confirm the 14-day trial appears (L5) and the subscription status is `trialing`.
3. Portal → switch to Elite → tier flips to elite.
4. Portal → cancel → tier flips to free, and the Elite pages lock again.
5. On Elite, add an 11th booking calendar → confirm a $5 quantity line item appears on the
   subscription (`syncExtraCalendarQuantity` in `lib/stripe.ts`). Remove it → line item goes.

**Do not proceed to live mode until all five pass.**

## Part 5 — Live mode

Once activation clears, repeat Part 1–3 in Live mode. New Price ids, new webhook, new signing
secret. Test-mode ids do not work in live mode and fail in a confusing way.

## Done when

- [ ] Five test-mode steps all pass
- [ ] Live-mode Prices created and ids recorded (by the user, not in chat)
- [ ] Live webhook registered with the four events
- [ ] Portal allows cancel, payment update, and Premium↔Elite switching

# L8 — Operability

**Est:** 1.5h

## Why

Errors go to `console.error` and nowhere else. Render's logs are ephemeral. There is no health
endpoint. Once strangers are using this you cannot support what you cannot see.

## Build

**`app/api/health/route.ts`.** Returns 200 with `{ ok: true, commit, checks: { db } }`. One
cheap Supabase query (`select id from clients limit 1`) so it fails when the database is
unreachable, which is the outage that actually happens. `runtime = 'nodejs'`, no auth, no
secrets in the body. Point an uptime monitor at it.

**Sentry.** `@sentry/nextjs`, free tier. Wire `sentry.client.config.ts`,
`sentry.server.config.ts`, and `sentry.edge.config.ts`. Set `tracesSampleRate` low (0.1) and
turn session replay off — you don't need it and it's a privacy surface you'd have to disclose.

Then replace the bare `console.error` calls in the paths where silence is expensive, keeping
the existing behavior and adding capture:
- `app/api/stripe/webhook/route.ts` — every failure branch. A dropped webhook is a customer who
  paid and wasn't upgraded.
- `lib/booking.ts` and `app/api/client/appointments/[id]/route.ts` — the
  `google_writeback_failed` path. It already logs to `error_log` for the client; you want to
  see it too.
- `app/api/cron/*` — a cron that silently stops is invisible otherwise.
- `lib/stripe.ts`'s `syncExtraCalendarQuantity` catch sites.

**Scrub PII before it leaves.** Visitor names and phone numbers must not go to Sentry. Add a
`beforeSend` that drops request bodies on `/api/visitor/*` and redacts `phone`, `visitor_name`,
`visitor_email`. Add Sentry to the privacy policy's sub-processor list from L1.

**Don't** add structured logging, a metrics stack, or a dashboard. One error tracker and one
health check is the right amount for a product with zero customers.

## Done when

- [ ] `/api/health` returns 200 live, and non-200 when the DB is unreachable
- [ ] A deliberately thrown error appears in Sentry from both client and server
- [ ] A simulated visitor booking error in Sentry contains no name, phone, or email
- [ ] Sentry named in the privacy policy
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

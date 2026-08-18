# C4 — Render

**Runs after:** C2 (Stripe ids exist) and C3 (Supabase + Resend keys exist).

Read `.launch/chrome/README.md` first. **Every value in Part 2 is a secret or near-secret. The
user types them.** Claude's job here is to get to the right screen, confirm what's already set,
and catch what's missing — not to fill the form.

## Part 1 — Custom domain

Web Service → Settings → Custom Domains → add `gathertime.com` and `www.gathertime.com`.
Render prints the exact DNS records; the user adds them at the registrar. Wait for the
certificate to issue. Set `www` to redirect to the apex.

Instance type must be **Starter ($7/mo)**. The free tier spins down after 15 minutes idle,
which means a booking link that takes 40 seconds to load for the first visitor of the day.

## Part 2 — Environment

Read back what's currently set and diff it against `.env.example`. Then, the user sets:

**Delete outright:**
- `ALLOW_ADMIN_LOGIN` — remove the variable, don't set it to `false`. It enables a fixed
  admin/admin1 credentials provider *and* `POST /api/client/dev-tier-toggle`, which writes
  `tier` directly. The flag's absence is the whole defense.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` — same.

**Set or rotate:**
- `NEXTAUTH_URL=https://gathertime.com`
- `NEXTAUTH_SECRET` — fresh: `openssl rand -base64 32`
- `CRON_SECRET` — fresh, long, random
- `EMAIL_FROM_ADDRESS=noreply@gathertime.com`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PREMIUM_PRICE_ID`,
  `STRIPE_ELITE_PRICE_ID`, `STRIPE_ELITE_EXTRA_CALENDAR_PRICE_ID` — **live mode**
- `SENTRY_DSN` if L8 shipped

**Leave unset:** every `TWILIO_*` variable. L4 removes the SMS claim; the cron route already
skips cleanly when they're absent.

## Part 3 — Cron Jobs

Render Cron Jobs are a **separate resource type** from the Web Service. Create three:

| Name | Schedule | Command |
|---|---|---|
| google-sync | every 30 min | `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://gathertime.com/api/cron/google-sync` |
| cleanup | daily | same shape, `/api/cron/cleanup` |
| export-monthly | 1st of month | same shape, `/api/cron/export-monthly` |

Not `sms-reminders` — it can't send anything.

Each job needs `CRON_SECRET` in its own environment; cron jobs don't inherit the web service's.
Use `curl -fsS` so a non-200 actually fails the job instead of passing silently.

## Part 4 — Verify

- `https://gathertime.com/api/health` returns 200 (L8)
- `curl -X POST https://gathertime.com/api/cron/google-sync` with **no** header is rejected
- The deploy log shows no missing-env warnings

## Done when

- [ ] Apex and www resolve over HTTPS with a valid certificate
- [ ] Starter instance, not free
- [ ] `ALLOW_ADMIN_LOGIN` and the three `ADMIN_*` vars are absent
- [ ] All Stripe vars are live-mode
- [ ] Three cron jobs created and each has run successfully at least once

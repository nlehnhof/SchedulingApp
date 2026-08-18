# Gather — Launch Plan

> Companion to `claude/launch-readiness-pricing-and-competitive-position.md` in the Claude
> project. That doc is the *findings*. This is the *execution*.
>
> Target: public self-serve launch on **gathertime.com**, with real Stripe payments and a
> verified Google OAuth app.

---

## How this plan is run

Three tracks, run in parallel where the dependency graph allows.

| Track | Where | What |
|---|---|---|
| **Code** (`L1`–`L9`) | Claude Code, in this repo | `.launch/code/*.md`, one phase per session |
| **Chrome** (`C1`–`C5`) | Claude in Chrome, with you watching | `.launch/chrome/*.md`, one dashboard per session |
| **You** | Your hands only | §"For You to Do" below |

`.launch/next-prompt.md` holds the current baton. After finishing a phase, update it to point
at the next one, the same way `.design/next-prompt.md` worked for Nightshift.

### Rules

- **One phase per session.** Each phase file lists its own done-when. If a box can't honestly
  be ticked, the phase isn't done.
- **Never commit unless asked.** Same standing rule as the rest of this repo.
- **`npx tsc --noEmit`, `npm run lint`, `npm test` clean before any phase is called done.**
- **Claude in Chrome never handles a secret.** It can navigate, fill non-secret fields, read
  config back, and screenshot. Every API key, signing secret, and password gets typed or
  pasted by you directly, because anything on a page Chrome reads ends up in model context.
- **Test mode before live mode** for everything Stripe.

---

## Critical path

The only two items with real waiting time are the domain (DNS propagation, hours) and Google
OAuth verification (up to 10 days *after* submission, and submission requires a live domain
plus live legal pages). Everything else is effort, not calendar.

```
  YOU-1 buy gathertime.com ──┬── YOU-2 DNS → Render ──┬── YOU-4 Search Console (C1)
                             │                        │
                             └── YOU-3 Resend DNS     └── L1 legal pages live on the domain
                                                              │
                                                              └── YOU-6 record demo video
                                                                        │
                                                                        └── YOU-7 SUBMIT ← up to 10 days
                                                                                  │
  Everything else runs during that wait ──────────────────────────────────────────┴─→ LAUNCH
```

**So: buy the domain and ship L1 first.** Nothing else on the list unblocks the wait.

---

## Phases

### Code (Claude Code)

| # | File | What | Est | Blocks |
|---|---|---|---|---|
| L0 | *(done)* | Narrow Google Calendar scopes to `calendar.events` + `calendar.calendarlist.readonly` | — | C1 |
| L1 | `code/L1-legal-and-trust.md` | `/privacy`, `/terms`, footer links, support email | 2h | Google verification, Stripe activation |
| L2 | `code/L2-tier-enforcement.md` | Server-side tier gate + seat cap on the team routes | 1h | selling Premium/Elite |
| L3 | `code/L3-timezone-capture.md` | Detect and require a timezone at signup | 2h | any non-UTC customer |
| L4 | `code/L4-pricing-truth.md` | Prices on the marketing page, 5→10/20 fix, strip SMS claims | 1.5h | self-serve signup |
| L5 | `code/L5-billing.md` | 14-day trial, checkout/portal copy, tier-change edge cases | 1.5h | conversion |
| L6 | `code/L6-account-deletion.md` | Delete account + disconnect Google | 2h | Google verification |
| L7 | `code/L7-visitor-self-service.md` | Signed cancel/reschedule link for visitors | 4h | support load |
| L8 | `code/L8-ops.md` | `/api/health`, Sentry, log hygiene | 1.5h | operating it |
| L9 | `code/L9-preflight.md` | Full verification sweep + screenshots | 2h | launch |

**L1 → L2 → L3 → L4 are the blocking four.** L5–L8 can be reordered freely. L7 is the one
worth cutting if time runs out; L6 is not, because Google asks about deletion.

### Chrome (Claude in Chrome)

| # | File | Dashboard | Runs after |
|---|---|---|---|
| C1 | `chrome/C1-google-cloud.md` | Google Cloud Console + Search Console | L1 live on gathertime.com |
| C2 | `chrome/C2-stripe.md` | Stripe (test mode, then live) | YOU-5 activation approved |
| C3 | `chrome/C3-supabase-resend.md` | Supabase + Resend | YOU-1 |
| C4 | `chrome/C4-render.md` | Render env, domain, cron jobs | C2, C3 |
| C5 | `chrome/C5-smoke-test.md` | The live site, end to end | everything |

---

## For You to Do

Ordered. Steps that unblock waiting are first even when they're not the most urgent.

### Today — start the clocks

**YOU-1. Register `gathertime.com`.**
All seven `gathertime.*` TLDs came back with no nameservers when I checked, so `.com` looks
open — confirm at the registrar, since "no NS" isn't proof of availability. Go `.com`: your
buyers are churches and small nonprofits, and `.com` is the trust default for that audience.
`gathertime.app` is the fallback (it force-HTTPS via HSTS preload, which is fine with Render).
Any registrar is fine; Cloudflare and Porkbun both sell at cost and won't upsell you.
*Turn on auto-renew.* A lapsed domain takes down OAuth, email, and billing at once.

**YOU-2. Point the domain at your existing Render service.**
In Render → your web service → Settings → Custom Domains → add `gathertime.com` **and**
`www.gathertime.com`. Render will show you the exact DNS records to create (an A or ALIAS at
the apex, a CNAME for `www`). Copy them into your registrar's DNS. Do not use records from
memory or from a blog post — use the values Render prints. Wait for Render to show the
certificate as issued; usually minutes, occasionally hours.

**YOU-3. Start Stripe account activation.**
dashboard.stripe.com → Activate account. Business details, tax info, and a bank account.
This is a review that takes anywhere from minutes to a few days, so start it now even though
you can't create live prices until it clears. Test mode works throughout.

**YOU-4. Upgrade Supabase to Pro ($25/mo).**
The Free plan **pauses a project after one week of inactivity** and keeps **no automatic
backups**. Neither is survivable under paying customers. Pro gives daily backups with 7-day
retention. Budget the real monthly floor at ~$35: $7 Render Starter + $25 Supabase Pro +
domain, before Resend and Stripe fees.

**YOU-5. Add `gathertime.com` to Resend and create its DNS records.**
resend.com → Domains → Add. It'll give you DKIM, SPF, and (usually) an MX record on a
`send.` subdomain. Until this verifies, Resend is in sandbox and delivers **only** to your own
account address — every customer's confirmation email silently goes nowhere.

### Once L1 is deployed and gathertime.com serves `/privacy`

**YOU-6. Verify the domain in Google Search Console.**
search.google.com/search-console → Add property → Domain → `gathertime.com` → add the TXT
record it gives you. Google's OAuth verification will not accept an authorized domain you
haven't proven you own. (C1 can drive this with you.)

**YOU-7. Fill in the OAuth consent screen** (C1 drives, you approve):
- User type: **External**, then **Publish** (not Testing — testing caps refresh-token life).
- App name `Gather`, logo `public/gather_logo.png`, support email, developer contact.
- Application home page `https://gathertime.com`
- Privacy policy `https://gathertime.com/privacy`
- Terms of service `https://gathertime.com/terms`
- Authorized domain `gathertime.com`
- Authorized redirect URI `https://gathertime.com/api/auth/callback/google`
- Scopes — exactly these three plus openid/email/profile, nothing more:
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

**YOU-8. Record the demo video.** Unlisted on YouTube, 2–4 minutes, screen recording with
narration. Google's reviewers want to see, in one take: the homepage → clicking sign in → the
**full consent screen with the scopes visible** → what the app does with each scope. Show the
calendar picker (that's `calendarlist.readonly`), then book an appointment and show it appear
on the Google Calendar (that's `calendar.events`). Say the app's name out loud and show the
URL bar on `gathertime.com` throughout.

**YOU-9. Paste this into the scope justification field and submit.**

> Gather is an appointment booking tool. A signed-in user connects one of their own Google
> calendars so that (a) times they are already busy are never offered to people booking with
> them, and (b) appointments booked through Gather appear on that calendar automatically.
>
> `calendar.events` — Gather reads events on the single calendar the user selects, over a
> ±30-day window, to determine which time slots are already busy, and it creates, updates, and
> deletes one event per appointment booked through Gather. We request `calendar.events` rather
> than the narrower `calendar.events.owned` because our users routinely connect a calendar
> that was shared with them by their organization (for example a shared building-reservation
> or counseling calendar) rather than one they personally own.
>
> `calendar.calendarlist.readonly` — Gather shows the user the list of their calendars so they
> can choose which one to connect. Read-only. Gather never creates, renames, subscribes to,
> unsubscribes from, or changes the sharing of any calendar.
>
> Gather does not request `calendar` or `calendar.readonly`. Those would grant access to every
> calendar the user can reach and to calendar settings, and neither is needed for the above.

Then submit, and **stop thinking about it**. Up to 10 days. Do the rest of the list while you
wait. If Google comes back with questions, answer within their deadline — a missed reply
restarts the queue.

### During the wait

**YOU-10. Apply migrations 0001–0021 in order** to the production Supabase project, via the
SQL Editor. `0016_calendar_id_fk_move.sql` is destructive (it drops `client_id` off five
tables). **Take a backup first** — you'll have them now that you're on Pro. C3 can walk this
with you.

**YOU-11. Create Stripe products and prices** — test mode first, then repeat in live mode once
activation clears (C2 drives):

| Product | Price | Type | Notes |
|---|---|---|---|
| Gather Premium | $19.00/mo USD | recurring, monthly | → `STRIPE_PREMIUM_PRICE_ID` |
| Gather Elite | $49.00/mo USD | recurring, monthly | → `STRIPE_ELITE_PRICE_ID` |
| Extra booking calendar | $5.00/mo USD | recurring, monthly, **quantity-based** | → `STRIPE_ELITE_EXTRA_CALENDAR_PRICE_ID` |

Skip annual pricing for launch. It needs a second Price *and* code to choose between them;
add it once someone has paid monthly.

**YOU-12. Register the Stripe webhook.** Endpoint `https://gathertime.com/api/stripe/webhook`,
events `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret into
Render as `STRIPE_WEBHOOK_SECRET` **yourself** — don't let Chrome read it.
**Without this webhook nobody who pays is ever upgraded.** `tier` is written in exactly one
place in the whole codebase: `app/api/stripe/webhook/route.ts`.

**YOU-13. Configure the Stripe Customer Portal** (Settings → Billing → Customer portal): allow
cancellation, allow plan switching between Premium and Elite, allow payment-method updates.
The app sends every existing subscriber here rather than to a second checkout.

**YOU-14. Set the Render environment.** C4 drives the navigation; you type the values.
- `ALLOW_ADMIN_LOGIN` — **remove it entirely.** Not `false`, gone. It enables a fixed
  admin/admin1 credentials login *and* `POST /api/client/dev-tier-toggle`, which writes `tier`
  directly. The flag is the only thing standing between a stranger and free Elite.
- `NEXTAUTH_URL=https://gathertime.com`, and a fresh `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
- `EMAIL_FROM_ADDRESS=noreply@gathertime.com`
- `CRON_SECRET` — a fresh random value
- All five `STRIPE_*` values, live mode
- Google client id/secret, Supabase URL + anon + service-role keys

**YOU-15. Create the four Render Cron Jobs** (a separate resource type from the Web Service).
Each is a `curl -X POST -H "x-cron-secret: $CRON_SECRET" https://gathertime.com/api/cron/<name>`:
`google-sync` every 30 min, `cleanup` daily, `export-monthly` on the 1st. Skip
`sms-reminders` — L4 removes that feature from the copy and it can't send anything anyway.

**YOU-16. Grant yourself Premium.** `premium_grants` already seeds `n.lehnhof01@gmail.com`
(migration `0010`). Confirm it survived into production, so you can use the product without
paying yourself.

### Before you tell anyone

**YOU-17.** Run C5, the smoke test. Sign in with a *second* Google account, on a real browser,
against the live site. Book something. Confirm the email arrives and the event lands on Google
Calendar **at the right hour**. Pay with a real card. Cancel. Confirm the downgrade.

**YOU-18.** Decide the nonprofit rate. A 30%-off Stripe coupon, applied by hand to churches
who ask, costs nothing to run and is the single strongest reason your named buyer picks you.
$19 reads as $13.30.

---

## Definition of done

- [ ] gathertime.com serves the app over HTTPS, `www` redirects to apex
- [ ] `/privacy` and `/terms` exist and are linked from the footer
- [ ] Google OAuth app is **verified** and published; consent screen shows two Calendar scopes
- [ ] A second Google account can sign in with no unverified-app warning
- [ ] Real card → Premium → tier flips to premium via webhook → portal → cancel → tier flips
      to free
- [ ] A free account cannot reach `/dashboard/team` or `POST /api/client/team`
- [ ] A new signup's timezone is correct without them touching anything
- [ ] Confirmation email arrives from `@gathertime.com`
- [ ] Booked appointment appears on Google Calendar at the correct wall-clock time
- [ ] `ALLOW_ADMIN_LOGIN` is absent from Render's environment
- [ ] Supabase is on Pro, a backup exists, migrations run through 0021
- [ ] Sentry has received at least one test event
- [ ] Nothing in the product claims to send SMS

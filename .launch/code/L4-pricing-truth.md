# L4 — Make the product's claims true

**Est:** 1.5h

## Why

Three separate places where the product says something that isn't so.

1. **`app/page.tsx`'s `Plans()` section shows no prices at all** — three cards, feature blurbs,
   zero numbers. `grep -c '$' ` over that section returns 0. For a self-serve launch that's
   disqualifying; a stranger decides on price and leaves if they can't find it.
2. **It says Elite is "Up to 5 booking calendars."** The code says 10 included, 20 maximum
   (`CALENDAR_INCLUDED_LIMIT_BY_TIER` / `CALENDAR_MAX_LIMIT_BY_TIER` in
   `app/api/client/calendars/route.ts:17-18`). `CLAUDE.md` line 11 also says 5.
3. **SMS reminders are advertised and cannot work.** `lib/sms.ts`'s `sendSms()` throws
   unconditionally by design, but `README.md` lists reminders under the premium tier and
   `.env.example` documents the Twilio vars.

## Build

**Prices on the marketing page.** Per the pricing doc §2.2:

| Tier | Price | Line |
|---|---|---|
| Free | $0 | 1 booking calendar, unlimited bookings, Google Calendar sync |
| Premium | **$19/mo** | + custom branding, custom link, analytics, confirmation emails, CSV export, **3 seats** |
| Elite | **$49/mo** | + 10 booking calendars, unlimited seats. Extra calendars $5/mo, up to 20 |

Set the number in `data-xl`, the `/mo` in `body-sm text-2`, and add the words **"per
organization, not per seat"** under the Premium card — that's the actual competitive claim and
it should be stated in those words. Keep the existing asymmetric-trio layout; Premium keeps the
taller lit card. Do not add a fourth card, an eyebrow, or a comparison table.

**Fix 5 → "10 included, up to 20"** in `app/page.tsx` and in `CLAUDE.md`'s "What this is".

**Strip SMS.** Remove reminders from the premium feature list in `README.md`, from any
marketing copy, and from the premium-features card on `app/dashboard/page.tsx`. Keep
`/dashboard/reminders` but change its content to an explicit "Not available yet" — do not leave
a form that appears to save something that will never send. Leave `lib/sms.ts`, the cron route,
and the `.env.example` block alone; they're honest as written and cost nothing.

**While you're in the copy:** the Nightshift pre-flight applies. Zero em-dashes in user-visible
strings, one CTA label per intent, and re-read every string you touch.

## Done when

- [ ] Prices visible on `/` without scrolling past the Plans heading, at 375px and 1280px
- [ ] "per organization, not per seat" appears on the Premium card
- [ ] No surface claims 5 calendars; no surface claims SMS
- [ ] `/dashboard/reminders` no longer presents a form that can't work
- [ ] `CLAUDE.md` and `README.md` match the code
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` clean

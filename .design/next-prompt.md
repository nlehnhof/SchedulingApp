---
page: dashboard-time
layout: foundation
phase: 6
---

Restyle `app/dashboard/schedule/page.tsx` and `app/dashboard/calendar/page.tsx` against the
Nightshift system. This is where the Lightline signature pays off on a real product surface: a
"now" indicator that tracks the clock, per `DESIGN.md` section 1.1 item 2.

Read `.design/DESIGN.md` in full and `.design/PLAN.md` Phase 6 before starting. Read both files
in full first — read `components/Lightline.tsx` and `components/DayStrip.tsx` (Phase 2) and
`components/Calendar.tsx` (already restyled in Phase 2, day cells already follow jade/rose
rails and the availability-is-light rule) before touching either page; reuse rather than
reinvent.

**Scope, exactly:**

1. **`app/dashboard/schedule/page.tsx`.** The `Calendar` component itself is already
   Nightshift-correct (Phase 2). Restyle the surrounding page chrome:
   - The legend row under the calendar (`bg-jade`/`bg-rose`/dimmed dots) — restyle to the
     token system; consider whether a legend is still needed now that `Calendar`'s own
     `aria-label` composition already describes state, or keep it as a compact visual key.
   - The selected-day heading (currently an uppercase-tracked caption showing the raw date
     string) and the "Click a day to see its appointments" / "No appointments booked on this
     day" empty states — restyle to `label`/`body-sm` tokens.
   - The inline delete-confirm row and its `Button` sizing overrides.
   - **Real "now" indicator.** This is the payoff. Add a live Lightline-driven view of today:
     when the selected date is today (or by default, before a date is selected), show a
     `DayStrip` for today's bucket built from the fetched `DayBucket.slots`/`.appointments`
     (real availability data is present here, unlike the dashboard home in Phase 5, which only
     had appointments) so open gaps render lit (`lume/8`) and booked segments render matte
     (`surface-2`), not just booked blocks on a blank strip. Scroll it into view on load if the
     page is tall enough to need it (a real "now" indicator that tracks the clock and scrolls
     into view on load, per `PLAN.md` Phase 6).
2. **`app/dashboard/calendar/page.tsx`.** A settings form, not a time-surface, but it's grouped
   into this phase by the plan. Restyle the `h1`, helper-text paragraphs (`text-xs`/`text-sm` →
   `body-sm`), the "No Google account connected" panel (already `bg-surface border-hairline` —
   bump radius to the documented system), and the save/error/saved feedback lines
   (`text-jade`/`text-rose` already correct, just retype the sizes). **Fix the em-dashes in
   this file's user-visible strings** (the timezone helper text, both slot-fill-direction
   option labels, and the "No Google account connected" helper text all currently use " — " as
   a separator; DESIGN.md section 9 bans this).
3. Day cells in `Calendar` already follow the availability-is-light rule and use jade/rose
   rails (Phase 2) — verify only, don't re-restyle `Calendar.tsx` itself here.

**Out of bounds:** routes, API shapes, form field names, SWR keys, tier gating logic, anything
under `lib/booking.ts` or `supabase/`. Do not touch `Calendar.tsx`, `AppointmentCard.tsx`, or
`AppointmentEditor.tsx` beyond what's needed to consume them correctly (their own restyle
already happened in Phase 2, and `AppointmentEditor` is a form built on Phase 1 primitives —
if it has stray raw tokens, note them but don't scope-creep a full restyle here unless trivial).

**Done when:** the schedule page's `DayStrip` renders real availability (lit gaps, matte
bookings) for today and updates its Lightline position live, both pages render correctly at
375px and 1280px, a grep for em-dash/en-dash separators in `app/dashboard/calendar/page.tsx`
and `app/dashboard/schedule/page.tsx` returns nothing outside comments, `npx tsc --noEmit` is
clean, `npm run lint` is clean, and `npm test` passes.

**Before finishing, write the Phase 7 baton to `.design/next-prompt.md`** using
`.design/PLAN.md` Phase 7 as the body, with the design system block below copied in, and mark
`dashboard-time` complete in `.design/SURFACES.md` section 4. If you skip this, the loop
stops.

---

DESIGN SYSTEM (REQUIRED):
- Product: Gather, rule-based appointment scheduling. Next.js 14 App Router, Tailwind v3.
- Theme: dark, locked. No light mode, no section inversion. color-scheme: dark.
- Concept: booked time is dark and matte; open time is lit. Glow is semantic, never decorative.
- Canvas #0D0F17, surface #141826, raised #1B2032, root #08090F
- Lines: hairline #242A3C decorative, hairline-2 #333B52 emphasized, edge #5D688A for all
  interactive control borders (only edge meets 3:1)
- Text #E9EBF4, secondary #9AA1BA, disabled #626A85
- Accent lume #FFB454, bright #FFD199, ink on accent #1A1206
- Status, product only, semantic only: jade #4FD6A4 confirmed, rose #FF7286 conflict,
  ice #79ADFF informational
- Type: Space Grotesk 700 display, Geist Sans UI, Geist Mono for every time, date,
  duration, count and stat. Load Geist from the `geist` npm package, not next/font/google.
- Radii: 10px controls, 14px cards, 20px modals, full for pills only
- Elevation is neutral black. Glow is accent tinted and reserved for the Lightline,
  available time, the primary CTA in view, and focus rings.
- Focus: 2px solid var(--lume), 2px offset, via focus-visible, everywhere
- Motion: `motion/react` only. 120ms hover, 200ms state, 420ms enter, spring 260/26 for
  physical. Transform and opacity only. useReducedMotion is mandatory.
- Icons: @phosphor-icons/react, regular weight, one family, no emoji, no hand rolled SVG
- Zero em-dashes in any user-visible string

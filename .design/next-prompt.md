---
page: dashboard-home
layout: foundation
phase: 5
---

Restyle `app/dashboard/page.tsx` (the `/dashboard` home) against the Nightshift system and the
Phase 4 shell it now sits inside. Read `.design/DESIGN.md` in full and `.design/PLAN.md`
Phase 5 before starting. Read the current file in full first — it already has the booking-link
card, `StatCard` component, `PremiumFeaturesCard` (icon already swapped to Phosphor `Lock` in
Phase 1), and setup nudges; restyle in place rather than rearchitecting the data fetching.

**Scope, exactly:**

1. **Booking link card.** Promote it. It's the single most useful thing on the page and
   currently reads like a footnote. Full width, `surface`, the link itself in `data` (mono),
   with a copy button that confirms in place (it already does via the `copied` state — just
   restyle, don't rebuild the interaction).
2. **Stat row.** Drop the card boxes (`StatCard`'s current `rounded-lg border ... p-4`
   treatment). Three stats in a row directly on `canvas`, value in `data-xl`, caption in
   `label` at `text-2`, separated by vertical `hairline` rules (not gaps/boxes). Pending
   errors turns `rose` when non-zero (already does via the `warn` prop — keep that logic,
   restyle the color/weight).
3. **Upcoming.** Add a `DayStrip` (from `components/DayStrip.tsx`, built in Phase 2) for
   today above the appointment list, built from the same `data.stats`/appointments payload
   this page already fetches. The list itself stays as `AppointmentCard` rows (already
   restyled in Phase 2 — don't touch `AppointmentCard.tsx` itself here).
4. **Setup nudges and premium features.** Keep both sections, restyle to the token system.
   The premium features list already dropped the emoji lock for a Phosphor `Lock` icon in
   Phase 1 — verify it still reads correctly against the new stat row treatment. Free-tier
   gating logic (which nudges/features show) is untouched.

**Out of bounds:** routes, API shapes, SWR keys, tier gating logic, anything under
`lib/booking.ts` or `supabase/`. Do not touch `DashboardNav`/`DashboardChrome` (Phase 4,
already done) or any other `/dashboard/*` route body.

**Done when:** the page renders correctly at 375px and 1280px, the stat row's `rose` warn
state still triggers correctly when `pending_errors > 0`, the copy-link button's confirm state
still works, `npx tsc --noEmit` is clean, `npm run lint` is clean, and `npm test` passes.

**Before finishing, write the Phase 6 baton to `.design/next-prompt.md`** using
`.design/PLAN.md` Phase 6 as the body, with the design system block below copied in, and mark
`dashboard-home` complete in `.design/SURFACES.md` section 4. If you skip this, the loop
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

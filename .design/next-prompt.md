---
page: visit
layout: foundation
phase: 3
---

Restyle the visitor booking flow — `app/visit/[clientLink]/page.tsx` and `layout.tsx` — against
the Nightshift system and the signature components Phase 2 just built. This is the
highest-visibility surface in the product; it is what the practitioner's own clients see.

Read `.design/DESIGN.md` in full (sections 2.4, 7) and `.design/PLAN.md` Phase 3 before
starting. Read `components/Lightline.tsx`, `components/DayStrip.tsx`, and `components/
TimeSlotGrid.tsx` as they exist after Phase 2 — reuse their patterns rather than inventing
parallel ones.

**Scope, exactly:**

1. **Shell.** `min-h-[100dvh]` on `canvas`. A single `rounded-2xl` `surface` panel,
   `max-w-[30rem]`, vertically centered from `sm` up, full bleed below it. Client logo and
   "Booking with {name}" above the panel, not inside it.
2. **Step rail.** Replace the four numbered circles with a Lightline-driven rail: a
   `hairline` track with a `lume` fill that animates to the new position on step change, the
   current step's label in `label` beneath it, and the step count in `data`. Keep
   `aria-current="step"` and the `aria-label="Booking progress"` on the list exactly as they
   are.
3. **Step 1, reason.** Reason cards at `rounded-xl` on `surface-2`, name in `body` weight
   500, duration in `data` right aligned, info note in `body-sm` `text-2` clamped to two
   lines. Hover lifts to `lift2` and warms the border to `lume/30`. Press `scale-[0.99]`.
4. **Step 2, date and time.** Keep the horizontal scroll-snap date pills; restyle to the slot
   chip states from `DESIGN.md` section 7. `TimeSlotGrid` already shows "N open" as of
   Phase 2. Empty state reads as an invitation, not a dead end.
5. **Step 3, details.** Pin a summary line at the top of the step showing the selected time
   in `data` and the reason in `body-sm`. Labels above inputs, errors below (already true of
   `Input`/`Select` as of Phase 1). The sticky footer bar stays; restyle to `surface` with a
   `hairline` top border and `backdrop-blur`.
6. **Step 4, confirmed.** The one orchestrated moment. The step rail completes, a `jade`
   check scales in (already a Phosphor `Check` as of Phase 1's icon sweep — keep it, just
   choreograph its entrance), and a `DayStrip` shows the booked block landing with the
   physical spring (stiffness 260, damping 26). Below it, the appointment time in `data`.
   Under `useReducedMotion()`, all of it renders in final position with no animation. Keep
   the existing `confirmationEmailSent` three-way logic and its copy intent exactly.
7. **Branding override.** Implement `lib/brand-color.ts`: a pure function that computes a
   client accent's relative luminance and picks `--lume-ink` (`--void` if the accent is
   light, `#FFFFFF` if dark), plus a contrast-lift helper that lightens the accent
   programmatically until it passes 4.5:1 against `--canvas`. Apply the result as inline
   `--lume` / `--lume-ink` CSS variables on the flow's root element in `layout.tsx`. Delete
   the `accentStyle` prop threading from `page.tsx` (the step dots, date pills, and `Button`
   `style` overrides) now that every control inherits the client accent automatically through
   the CSS variable. `TimeSlotGrid` already lost its `accentStyle` prop in Phase 2. Add
   Vitest coverage for the luminance and contrast-lift helpers in `lib/brand-color.test.ts`;
   they are pure functions and this repo tests pure functions (see `lib/availability.test.ts`
   for the existing pattern).

**Out of bounds:** routes, API shapes, form field names, SWR keys, tier gating, anything
under `lib/booking.ts` or `supabase/`. Do not touch the dashboard shell, `DashboardNav`, or
any `/dashboard/*` route.

**Done when:** all four steps render at 375px and 1280px, the conflict path and the
dismissible load-error banner still work, the flow is completable by keyboard alone with a
visible `focus-visible` ring at every stop, `lib/brand-color.ts` has passing Vitest coverage,
`npx tsc --noEmit` is clean, `npm run lint` is clean, and `npm test` passes.

**Before finishing, write the Phase 4 baton to `.design/next-prompt.md`** using
`.design/PLAN.md` Phase 4 as the body, with the design system block below copied in, and mark
`visit` complete in `.design/SURFACES.md` section 4. If you skip this, the loop stops.

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

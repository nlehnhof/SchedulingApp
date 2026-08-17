---
page: marketing
layout: wide
phase: 10
---

Rebuild `app/page.tsx` (the `/` marketing home) from scratch against the Nightshift system.
This is deliberately the **last** phase before docs: the hero is a live `DayStrip`, which
didn't exist until Phase 2, and every other section leans on real restyled components from
Phases 1-9. Read `.design/DESIGN.md` in full — section 0's dials table and section 10 in
particular — and `.design/PLAN.md` Phase 10 before starting. Read `components/DayStrip.tsx`,
`components/Lightline.tsx`, `components/RuleEditor.tsx`, and the current
`app/visit/[clientLink]/page.tsx` (its four steps, restyled in Phase 3) before writing a single
line — this page's job is to show off real components, not redraw them.

**Dials for this surface only:** DESIGN_VARIANCE 8, MOTION_INTENSITY 7, VISUAL_DENSITY 3. This
is deliberately the boldest surface in the app; don't self-censor toward the dashboard's
density 3-6 restraint.

**Structure — six sections, five distinct layout families, no family repeated:**

1. **Nav.** Single line, 64px, `canvas` with a `hairline` bottom border on scroll only.
   Wordmark left, one CTA right ("Client sign in"). Never two lines.
2. **Hero, asymmetric split.** `min-h-[100dvh]`, `pt-24` maximum. Left column: H1 ("Your open
   hours, and nothing else." or better if you have it, capped at 2 lines on desktop), one
   subtext line (max ~20 words), one CTA ("Client sign in"). Right column: a live `DayStrip` in
   a `rounded-2xl` `surface` panel, built from real-shaped placeholder data (a plausible day of
   matte/lit blocks), Lightline moving. Four text elements maximum in the left column. No trust
   strip, no tagline under the CTA, no version pill, no scroll cue.
3. **The guarantee, full-bleed statement over photography.** One claim: two people cannot book
   the same slot, because the database decides, not the app. Full-bleed night photograph
   graded to the canvas hue at low opacity behind the text (regrade `public/tetons.jpg`, or use
   a placeholder with a `TODO` comment to replace — do not ship a gradient blob instead of a
   photo). Inline micro-demo: two booking attempts race for one slot, one resolves to booked
   and one to "that slot just went" (real conflict copy from the booking flow, not invented
   text). This is the page's one storytelling animation.
4. **How the rules work, split with real UI.** Left: a real, non-interactive preview built from
   `RuleEditor`'s actual rendered markup for one populated `available_hours` rule (not a new
   component, and not a screenshot-shaped div). Right: three rule capabilities in a vertical
   stack separated by `hairline` rules, not cards.
5. **What the visitor sees, horizontal scroll-snap.** The four booking steps (reason,
   date/time, details, confirmed) as real rendered panels in a snap track, built from the
   actual restyled step markup in `app/visit/[clientLink]/page.tsx`, not redrawn. This is the
   only horizontal-scroll device on the page.
6. **Plans, asymmetric trio.** Three tiers, three cells, deliberately unequal: Premium is
   recommended and gets the taller lit card with `shadow-glow`; Free and Elite are quieter
   `surface` cards. Not three identical boxes.
7. **Footer.** Wordmark, one CTA with the same label as everywhere else, legal line. No version
   string, no locale strip, no weather.

**Hard constraints:**
- One accent. `lume` and neutrals only. No `jade`, `rose`, or `ice` anywhere on `/`.
- Zero eyebrows, anywhere.
- One CTA intent, one label: "Client sign in" in the nav, the hero, and the footer. Not
  "Get started" in one place and "Sign in" in another.
- Hero H1 fits two lines at desktop; CTA visible without scrolling; `pt-24` maximum.
- No fake screenshots built from divs. Every product visual on this page is a real component
  rendered with real-shaped data (the `RuleEditor` preview, the booking-step panels, the
  `DayStrip`).
- No scroll cue, no marquee beyond the one snap track, no rotated text, no decorative status
  dots, no section numbering, no locale/time strip.
- Retire `animate-kenburns` and `animate-float` from `tailwind.config.js` (tied to the old
  hero being fully replaced now) and remove the now-unused `<Image src={tetons}>` hero pattern
  from the old `app/page.tsx` if it isn't reused in section 3.
- Zero em-dashes/en-dashes in any user-visible string (the current `app/page.tsx` FEATURES copy
  has one — this whole file is being replaced, so it goes away with it, but double-check new
  copy you write).

**Out of bounds:** routes, API shapes, form field names, SWR keys, tier gating, booking logic.
This is presentation only — no changes to `/dashboard` or `/visit/[clientLink]` themselves,
only reuse of their already-restyled markup patterns for this page's real-component sections.

**Done when:** nav is one line at 1024px with no wrap, hero H1 is 2 lines max and CTA is
visible without scrolling, no section repeats a layout family, no duplicate CTA label, real
components (not div-screenshots) back every product visual, `npx tsc --noEmit` is clean,
`npm run lint` is clean, `npm test` passes, and the full pre-flight checklist in
`.design/PLAN.md` (both "every phase" and "marketing page only" sections) is honestly
checkable.

**Before finishing, write the Phase 11 baton to `.design/next-prompt.md`** using
`.design/PLAN.md` Phase 11 as the body (rewrite `theme_brand.md` to point at
`.design/DESIGN.md`, update `CLAUDE.md`'s styling section, delete references to Golden Hour/
Inter/Fraunces/old token names), with the design system block below copied in, and mark
`marketing` complete in `.design/SURFACES.md` section 4. If you skip this, the loop stops.

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

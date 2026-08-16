---
page: primitives
layout: foundation
phase: 1
---

Rewrite Gather's shared primitive components against the Nightshift token system that Phase 0
just landed. Phase 0 only renamed color/shadow/font classes in place; every primitive still
looks visually identical to the old "Golden Hour" system because no component was actually
restyled. This phase is the first real restyle pass.

Read `.design/DESIGN.md` in full (sections 4, 5, 7, and 8 especially) and `.design/PLAN.md`
Phase 1 before starting. Read each component file as it exists today before rewriting it —
preserve every prop, every piece of logic, every `aria-*` attribute, and every always-visible
action; only the markup/classes and, where the plan explicitly calls for it, the tone union
change.

**Scope, exactly — rewrite these against `DESIGN.md` section 7:**

1. `components/Button.tsx` — four variants (`primary`, `secondary`, `ghost`, `danger`), each
   with rest/hover/active/disabled treatments exactly as tabulated in section 7. Minimum 44px
   tall, `rounded-lg`, `body-sm` weight 500. `primary` gets `shadow-glow` only when it is the
   CTA currently in view (keep this conditional if the component already has a way to express
   "in view"; otherwise a `glow` boolean prop is fine — additive only, default `false`).
2. `components/Card.tsx` — `bg-surface border border-hairline rounded-xl shadow-lift1`; a
   hoverable variant adds `shadow-lift2` and `border-hairline-2` at 200ms. Cards never glow.
3. `components/Badge.tsx` — `rounded-full micro px-2.5 py-0.5`. Change the `Tone` union from
   `accent | highlight | success | danger | neutral` to `accent | ice | jade | rose | neutral`
   and update every call site (grep for `<Badge` and for `Tone`). Tone treatments:
   `neutral` `bg-text-2/12 text-text-2`, `accent` `bg-lume/14 text-lume-bright`, and `ice`/
   `jade`/`rose` each `bg-<color>/14 text-<color>`. Badges never glow.
4. `components/Input.tsx`, `components/Select.tsx` (and any `Textarea` if one exists) —
   `bg-surface-2 border border-edge rounded-lg`, text at `body`, placeholder at `text-3`.
   Label above at `label`, error below at `body-sm` in `rose`, error state swaps the border to
   `border-rose`. Focus uses the global `focus-visible` ring already in `globals.css` — do not
   add a component-local focus style that could conflict with it.
5. `components/Modal.tsx` — both the dialog and drawer variants. `rounded-2xl` (dialog) /
   unchanged corners on the full-height drawer, `shadow-lift3`, `bg-surface`. Replace the `✕`
   close glyph with a Phosphor `X` icon.
6. `components/Skeleton.tsx` — `bg-surface-2` with a slow shimmer using the `shimmer` keyframe
   Phase 0 already added to `tailwind.config.js`, disabled under reduced motion.
7. `components/Spinner.tsx` — keep it; per `DESIGN.md` section 7 it survives only for inline
   button-level pending states now that `Skeleton` covers full-section loading. Restyle its
   ring to the new tokens (already partially done in Phase 0's mechanical pass — verify it
   reads as `border-hairline border-t-lume`).
8. `components/InfoTooltip.tsx` — trigger circle restyled per the edge/interactive-control
   treatment, popover panel as a `surface` panel with `shadow-lift2`. Replace the `i` glyph
   trigger with a Phosphor `Info` icon.
9. `components/PremiumLockCard.tsx` — becomes a genuinely good locked state per section 7's
   loading/empty/error philosophy: what the feature does, what it costs, one button. Replace
   any lock glyph with a Phosphor `Lock` icon.
10. `components/SignInButton.tsx`, `components/SignOutButton.tsx` — restyle to the `Button`
    primitive's variants rather than one-off classes, if they aren't already composed from it.
11. `components/ErrorBanner.tsx` — inline and specific per the error-state philosophy in
    section 7. Replace the `✕` dismiss glyph with a Phosphor `X` icon.
12. `components/CollaboratorBanner.tsx` — restyle to the token system; this banner uses `ice`
    (it signals "shared with you", not an error or success state).

**Icon sweep — replace every raw glyph/emoji with `@phosphor-icons/react` v2,
`weight="regular"`, `size={18}` inline / `size={20}` nav, per `DESIGN.md` section 8:**

- `components/DashboardNav.tsx` — `☰` menu glyph, and the replay-tutorial `?` button
- `components/MonthGridHeader.tsx` — `←` `→` month nav arrows
- `components/Modal.tsx` and `components/ErrorBanner.tsx` — `✕` close glyphs
- `app/page.tsx` — `↓` scroll cue (leave the rest of this file alone; Phase 10 rebuilds it
  entirely, this is just the icon swap so the grep in `DESIGN.md` section 8 comes back clean)
- the booking confirmation checkmark in `app/visit/[clientLink]/page.tsx` — `✓`
- `components/InfoTooltip.tsx` — the `i` trigger glyph
- `app/dashboard/page.tsx` — the premium features list `🔒`

Do not hand-roll SVG paths for anything Phosphor doesn't have; compose from Phosphor
primitives or pick a different metaphor instead.

**Out of bounds:** routes, API shapes, form field names, SWR keys, tier gating, anything
under `lib/booking.ts` or `supabase/`, and the signature components (`Lightline`, `DayStrip`,
`TimeSlotGrid`, `Calendar`, `AppointmentCard`, `DatesMultiSelect`, `MonthGridHeader`'s layout
beyond its icon swap) — those are Phase 2. Don't touch `app/page.tsx` beyond its one icon
swap; it gets fully rebuilt in Phase 10.

**Done when:** every primitive renders correctly in isolation at both 1280px and 375px, all
four interaction states exist on `Button` (rest, hover, active, disabled) with visible
`focus-visible` rings, `Badge`'s new `Tone` union has zero remaining call sites on the old
names, a grep for `✕`, `✓`, `☰`, `←`, `→`, `?` (as a standalone icon glyph, not literal
question marks in copy), `🔒`, and `i` (as an icon glyph) across `app/` and `components/`
turns up only the two known exceptions noted above (`app/page.tsx`'s `↓` and the confirmation
`✓`, both explicitly listed as in-scope here so they should in fact be gone too — the true
done state is zero raw glyphs left anywhere), `npx tsc --noEmit` is clean, `npm run lint` is
clean, and `npm test` passes.

**Before finishing, write the Phase 2 baton to `.design/next-prompt.md`** using
`.design/PLAN.md` Phase 2 as the body, with the design system block below copied in, and mark
`primitives` complete in `.design/SURFACES.md` section 4. If you skip this, the loop stops.

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

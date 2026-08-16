---
page: dashboard-shell
layout: foundation
phase: 4
---

Restyle the dashboard shell — `components/DashboardNav.tsx`, `components/DashboardChrome.tsx`,
the signed-out state in `app/dashboard/layout.tsx`, `components/CollaboratorBanner.tsx`, and
`components/OnboardingTour.tsx` — against the Nightshift system. This is the frame every
dashboard page sits inside, so get it right once here rather than per-page.

Read `.design/DESIGN.md` in full and `.design/PLAN.md` Phase 4 before starting. Read
`components/DashboardNav.tsx` as it exists after Phases 0-1 (icon sweep already done: `List`
for the mobile hamburger, `Question` for replay-tutorial) — reuse its existing structure and
data (`SETUP_LINKS`, `OPERATE_LINKS`, `PREMIUM_LINKS`, `ELITE_LINKS`, the tier dev-toggle,
the calendar switcher) and restyle rather than rearchitect.

**Scope, exactly:**

1. **Sidebar.** 224px wide (`md:w-56` already matches), `surface` on `canvas`, separated by a
   `hairline` right border (already `md:border-r md:border-hairline` from Phase 0's mechanical
   pass — verify, don't reintroduce `hairline-2` or `edge` there). Wordmark in `display-sm`
   (currently `font-display text-lg font-semibold` — swap to the named `display-sm` scale
   token).
2. **Active nav item.** Replace the filled-pill treatment (`bg-lume/30 text-text`) with a 2px
   `lume` left rail plus `bg-lume/8`. Inactive stays `text-text-2 hover:bg-lume/15` (or close
   to it — keep the hover legible). Do this in both `renderGroup()` and the `Home` link.
3. **Group headings.** `label` at `text-3` (currently `text-[10px] font-semibold uppercase
   tracking-wide text-text-2/70` — replace with the named `label` scale token and `text-3`).
4. **Mobile top bar and drawer.** Keep their current structure and their full account block
   (email, calendar switcher, dev tier-toggle, sign-out) exactly as-is; only the styling
   changes to match the restyled sidebar (wordmark size, group heading treatment, active-item
   treatment reused inside the drawer's nav list too).
5. **Signed-out state** (`app/dashboard/layout.tsx`). Center the wordmark, one sentence, one
   `SignInButton`. Read the current signed-out branch before rewriting it — preserve whatever
   copy/logic is there beyond the visual treatment.
6. **Admin-login testing warning.** Keep its `rose` treatment; it is a real warning, not
   decoration to be muted.
7. **`CollaboratorBanner.tsx`.** Already restyled to `ice` in Phase 1 (semantic: "shared with
   you"/collaborator affordance) — verify it still reads correctly against the restyled
   sidebar/topbar and adjust spacing only if the new shell layout requires it.
8. **`OnboardingTour.tsx`.** Restyle against the token system (it renders inside `Modal`, which
   is already Nightshift-correct as of Phase 1 — verify the tour's own step content/copy
   panels use `surface`/`hairline`/`lume` consistently, not leftover raw values).

**Out of bounds:** routes, API shapes, form field names, SWR keys, tier gating logic, anything
under `lib/booking.ts` or `supabase/`. Do not touch `/dashboard/page.tsx` or any other
dashboard route body content — that is Phase 5 onward. Do not touch the visitor booking flow
or the marketing page.

**Done when:** the nav renders on one line per item with no wrap at 1024px, the drawer opens
and closes, the tier lock pills read correctly at all three tiers (free/premium/elite),
`npx tsc --noEmit` is clean, `npm run lint` is clean, and `npm test` passes.

**Before finishing, write the Phase 5 baton to `.design/next-prompt.md`** using
`.design/PLAN.md` Phase 5 as the body, with the design system block below copied in, and mark
`dashboard-shell` complete in `.design/SURFACES.md` section 4. If you skip this, the loop
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

---
page: _complete
---

The Nightshift redesign is complete. All 11 surfaces in `.design/SURFACES.md` section 4 are
built: tokens, primitives, signature components, the visitor booking flow, the dashboard
shell, and every dashboard page, ending with the marketing page and this documentation pass.

## What was built, phase by phase

- **Phase 0 — tokens.** Replaced the "Golden Hour" warm/cream palette with the Nightshift
  dark token system: CSS custom properties in `app/globals.css`, `tailwind.config.js`
  colors/type scale/shadows/radii, Space Grotesk + Geist fonts. Mechanically migrated every
  old class name across `app/` and `components/`.
- **Phase 1 — primitives.** Restyled Button, Card, Badge, Input, Select, Modal, Skeleton,
  Spinner, InfoTooltip, PremiumLockCard, SignOutButton, ErrorBanner, CollaboratorBanner.
  Swept every raw glyph/emoji for a Phosphor icon.
- **Phase 2 — signature components.** Built `Lightline` (the "now" indicator) and `DayStrip`
  (a day as a lit/matte band), then restyled TimeSlotGrid, Calendar, MonthGridHeader,
  DatesMultiSelect, AppointmentCard against them.
- **Phase 3 — visitor booking flow.** Rebuilt the `/visit/[clientLink]` shell, replaced the
  numbered-circle step indicator with a Lightline-driven rail, restyled all four steps, and
  added `lib/brand-color.ts` (luminance/contrast/ink-pick/contrast-lift, tested) to apply a
  premium client's accent as a `--lume`/`--lume-ink` CSS variable override.
- **Phase 4 — dashboard shell.** DashboardNav's active-item left-rail treatment, signed-out
  state, OnboardingTour.
- **Phase 5 — dashboard home.** Promoted booking-link card, bare stat row, `DayStrip` for
  today.
- **Phase 6 — dashboard time.** The schedule page now shows a live `DayStrip` built from
  real per-slot availability.
- **Phase 7 — dashboard setup.** Reasons/Rules moved from a grid-of-cards to a
  hairline-divided flat list (density 6).
- **Phase 8 — dashboard data.** Analytics/errors/export retyped to the token system; hand-
  rolled bars kept as specified.
- **Phase 9 — dashboard account.** Branding/reminders/billing/team/calendars restyled;
  branding now previews the accent color live against the canvas with a real contrast
  warning.
- **Phase 10 — marketing page.** `/` rebuilt from scratch: asymmetric hero with a live
  `DayStrip`, a full-bleed guarantee section with a real two-visitor conflict race demo,
  a real `RuleEditor`-pattern preview, the four real booking-flow steps in a scroll-snap
  track, an asymmetric plans trio, single-CTA nav/hero/footer. Verified in a real browser
  at 1280px — hero, guarantee, rules, visitor-steps, plans, and footer sections all render
  correctly with no console errors.
- **Phase 11 — docs.** `theme_brand.md` rewritten as a pointer to `.design/DESIGN.md`;
  `CLAUDE.md` gained a Styling bullet in its Structure section.

## What's still open (not blocking, not part of this pass)

- Open Graph image for `/` rendered from the token system.
- A real re-edit of `public/tetons.jpg` itself (currently regraded via CSS filters only,
  which is what shipped in Phase 10).
- Light theme variant — explicitly out of scope for the whole pass.
- A motion-reduced screenshot regression pass.
- Mobile-width (375px) visual verification of the marketing page specifically — desktop
  (1280px) was verified in a real browser; mobile relies on the same responsive Tailwind
  patterns already verified across every other phase, but wasn't itself screenshotted due
  to a window-resize tool limitation in that session.

If picking this back up: read `.design/DESIGN.md` and `.design/PLAN.md` for the system, and
`.design/SURFACES.md` section 5 for what's left. There is no phase 12 script — treat any of
the items above as a fresh one-off task, not a continuation of the phased loop.

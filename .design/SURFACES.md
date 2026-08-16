# Gather: surface map and roadmap

> **Read this file at the start of every design-loop iteration.** It is the project's
> long-term memory. `.design/DESIGN.md` is the visual source of truth;
> `.design/PLAN.md` is the phased execution detail; this file tracks what is done and what
> is next.

This is the design-loop `SITE.md` adapted for a Next.js App Router product rather than a
static multi-page HTML site. Same baton pattern, same one-unit-per-iteration discipline,
but a "page" here is a route or a component layer inside `app/` and `components/`, not a
file in `site/public/`.

---

## 1. Core identity

| Field | Value |
|---|---|
| Product | Gather |
| Mission | Let a practitioner give away only the hours they meant to give away |
| Users | Clients (paying practitioners, use the dashboard) and visitors (book through a private link, never sign in) |
| Voice | Plain, direct, specific. Active voice. Sentence case. No filler verbs |
| Region | US. Local-time formatting via the client's configured timezone |

## 2. Visual language

- **Primary:** dark canvas, luminous. Booked time is matte, open time is lit.
- **Secondary:** precise. Every value set in mono, tabular, aligned.
- **Anti-vibes:** not warm-boutique (that was the outgoing Golden Hour system), not
  generic dark-tech neon, not glowing everywhere, not decorative.

## 3. Technical setup

- Next.js 14.2 App Router, React 18, TypeScript
- Tailwind v3.4 driven by CSS custom properties. Staying on v3; no v4 migration in this
  pass, and defining tokens as CSS variables keeps a future v4 move cheap
- Theme: dark only, locked
- Fonts: Space Grotesk via `next/font/google`; Geist Sans and Geist Mono via the `geist`
  package
- Animation: `motion` (`motion/react`)
- Icons: `@phosphor-icons/react`
- Verification: Playwright screenshots at 1280px and 375px into `.design/screenshots/`

## 4. Surface map

Update this when an iteration completes. Do not rebuild anything already marked `[x]`.

- [x] `tokens` - `tailwind.config.js`, `app/globals.css`, `app/layout.tsx`, deps, fonts
- [x] `primitives` - Button, Card, Badge, Input, Select, Modal, Skeleton, Spinner, InfoTooltip, PremiumLockCard, icon swap
- [x] `signature` - `Lightline`, `DayStrip`, plus `TimeSlotGrid`, `Calendar`, `MonthGridHeader`, `AppointmentCard`, `DatesMultiSelect`
- [x] `visit` - `/visit/[clientLink]` booking flow and its layout
- [x] `dashboard-shell` - `DashboardNav`, `DashboardChrome`, `CollaboratorBanner`, `OnboardingTour`, dashboard layout signed-out state
- [x] `dashboard-home` - `/dashboard`
- [ ] `dashboard-time` - `/dashboard/schedule`, `/dashboard/calendar` (the Lightline payoff)
- [ ] `dashboard-setup` - `/dashboard/reasons`, `/dashboard/rules`, `RuleEditor`
- [ ] `dashboard-data` - `/dashboard/analytics`, `/dashboard/errors`, `/dashboard/export`
- [ ] `dashboard-account` - `/dashboard/branding`, `/dashboard/reminders`, `/dashboard/billing`, `/dashboard/team`, `/dashboard/calendars`
- [ ] `marketing` - `/` home page
- [ ] `docs` - rewrite `theme_brand.md`, update `CLAUDE.md` styling section

## 5. Roadmap

### High priority
- [ ] Everything in section 4, in the listed order. The order is a dependency chain, not a
      preference: tokens before primitives, primitives before surfaces, real product
      components before the marketing page that embeds them.

### Medium priority
- [x] `lib/brand-color.ts` with luminance and contrast-lift helpers, plus Vitest coverage,
      for the premium per-client accent override (done in Phase 3)
- [ ] Open Graph image for `/` rendered from the token system
- [ ] Replace or regrade `public/tetons.jpg`; it belongs to the retired warm palette

### Low priority
- [ ] Light theme variant (explicitly out of scope for this pass)
- [ ] Motion-reduced screenshot pass as a regression check

## 6. Rules of engagement

1. One unit per iteration. Never batch two surfaces into one pass.
2. Always update `.design/next-prompt.md` before finishing, or the loop dies.
3. Copy the design system block from `DESIGN.md` section 11 into every baton verbatim.
4. Read the most recently completed surface's code before writing the next one, and reuse
   its patterns rather than inventing parallel ones.
5. Presentation layer only. No changes to routes, API shapes, form field names, tier
   gating, SWR keys, or booking logic.
6. Run `npx tsc --noEmit`, `npm run lint`, and `npm test` before marking an iteration done.
7. Screenshot at 1280 and 375 and actually look at the result before claiming completion.
8. Preserve every existing accessibility affordance. The `aria-label` composition in
   `Calendar.tsx`, the `aria-expanded` and `aria-controls` on `AppointmentCard`, the
   `aria-current="step"` in the booking flow, and the always-visible (not hover-only)
   action buttons are all deliberate. Do not regress them.

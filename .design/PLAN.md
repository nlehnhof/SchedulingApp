# Gather Nightshift: execution plan

> For Claude Code. Read `.design/DESIGN.md` first, then this. Work one phase per
> iteration, driven by `.design/next-prompt.md`. Update `.design/SURFACES.md` section 4
> as each phase completes.

---

## Phase 0: tokens and foundation

**Install.** Verify against `package.json` before importing anything.

```bash
npm install motion@^13 @phosphor-icons/react@^2 geist@^1.7
```

`motion` is the current name of the library formerly published as `framer-motion`; import
from `motion/react`. Do not install `framer-motion` as well.

**`app/layout.tsx`.** Remove the `Inter` and `Fraunces` imports. Add:

```tsx
import { Space_Grotesk } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
```

Expose `--font-display`, `--font-sans`, `--font-mono`. Set `<html lang="en" className="dark">`
with the three font variables, and `<body className="bg-canvas text-text">`. Add
`export const metadata` with an updated description and
`export const viewport = { colorScheme: 'dark', themeColor: '#0D0F17' }`.

**`app/globals.css`.** Keep the three `@tailwind` directives. Add the `:root` block from
`DESIGN.md` section 2 verbatim. Add a global `*:focus-visible` rule implementing the focus
treatment from `DESIGN.md` section 5, and a `@media (prefers-reduced-motion: reduce)` block
that zeroes animation and transition durations as a backstop behind the per-component
`useReducedMotion()` guards.

**`tailwind.config.js`.** Replace the `colors`, `fontFamily`, `boxShadow`, `keyframes`, and
`animation` blocks. Colors reference the CSS variables through the alpha-value pattern so
tints work:

```js
lume: {
  DEFAULT: 'rgb(var(--lume-rgb) / <alpha-value>)',
  bright:  'rgb(var(--lume-2-rgb) / <alpha-value>)',
  ink:     'rgb(var(--lume-ink-rgb) / <alpha-value>)',
},
```

Add the `fontSize` scale from `DESIGN.md` section 3.2. Delete `kenburns` and `float`; they
belonged to the retired hero. Keep a `fade-up` equivalent for CSS-only entrances and add a
`shimmer` for `Skeleton` and a `bloom` for the Lightline.

**Do not leave the old tokens in place "so nothing breaks."** The previous config kept
Tailwind's stock palette alongside the brand palette, which let off-brand values survive.
Remove `background`, `surface`, `border`, `text-primary`, `text-secondary`, `accent`,
`highlight`, `success`, and `danger`, then fix every resulting build error. A failing build
is the tool that finds the stragglers.

**Done when:** `npm run build` succeeds, the app renders dark, no reference to `Inter`,
`Fraunces`, or any old token name remains in `app/` or `components/`.

---

## Phase 1: primitives

Rewrite against `DESIGN.md` section 7: `Button`, `Card`, `Badge`, `Input`, `Select`,
`Modal`, `Skeleton`, `Spinner`, `InfoTooltip`, `PremiumLockCard`, `SignInButton`,
`SignOutButton`, `ErrorBanner`, `CollaboratorBanner`.

Component API changes are additive only. `Button`'s variant union gains nothing and loses
nothing; `Badge`'s `Tone` union changes from `accent | highlight | success | danger | neutral`
to `accent | ice | jade | rose | neutral`, so update every call site.

Sweep every emoji and raw glyph used as an icon and replace with Phosphor, per
`DESIGN.md` section 8. Known sites: `DashboardNav` (`☰`), `MonthGridHeader` (`←` `→`),
`Modal` and the booking error banner (`✕`), `app/page.tsx` (`↓`), the booking confirmation
(`✓`), `DashboardNav` replay-tutorial (`?`), `InfoTooltip` (`i`), and `app/dashboard/page.tsx`
premium list (`🔒`).

**Done when:** every primitive renders correctly in isolation at both breakpoints, all four
interaction states exist on `Button`, and `npx tsc --noEmit` is clean.

---

## Phase 2: signature components

Build `components/Lightline.tsx` and `components/DayStrip.tsx` to the spec in `DESIGN.md`
section 7. Build these before any surface that uses them, and build them well; they carry
the whole design.

Then restyle the time components against them: `TimeSlotGrid`, `Calendar`, `useMonthGrid`
consumers, `MonthGridHeader`, `DatesMultiSelect`, `AppointmentCard`.

`TimeSlotGrid` also loses its `accentStyle` prop in this phase, because Phase 3 moves
per-client branding to a CSS variable override. Do the prop removal here and have Phase 3
supply the variable.

**Done when:** the Lightline sits at the correct fraction of the day, updates on a timer,
blooms under normal motion, holds still under reduced motion, and `DayStrip` renders the
same in the dashboard and in a standalone harness.

---

## Phase 3: visitor booking flow

`app/visit/[clientLink]/page.tsx` and `layout.tsx`. This is the highest-visibility surface
in the product; it is what the practitioner's own clients see.

**Shell.** `min-h-[100dvh]` on `canvas`. A single `rounded-2xl` `surface` panel,
`max-w-[30rem]`, vertically centered from `sm` up, full bleed below it. Client logo and
"Booking with {name}" above the panel, not inside it.

**Step rail.** Replace the four numbered circles with the Lightline rail: a `hairline`
track with a `lume` fill that animates to the new position on step change, the current
step's label in `label` beneath it, and the step count in `data`. Keep `aria-current="step"`
and the `aria-label="Booking progress"` on the list exactly as they are.

**Step 1, reason.** Reason cards at `rounded-xl` on `surface-2`, name in `body` weight 500,
duration in `data` right aligned, info note in `body-sm` `text-2` clamped to two lines.
Hover lifts to `lift2` and warms the border to `lume/30`. Press `scale-[0.99]`.

**Step 2, date and time.** Keep the horizontal scroll-snap date pills; restyle to the slot
chip states. Add "N open" in `data` above the grid. Empty state reads as an invitation, not
a dead end.

**Step 3, details.** Pin a summary line at the top of the step showing the selected time in
`data` and the reason in `body-sm`. Labels above inputs, errors below. The sticky footer
bar stays; restyle to `surface` with a `hairline` top border and `backdrop-blur`.

**Step 4, confirmed.** The one orchestrated moment. The step rail completes, a `jade` check
scales in, and a `DayStrip` shows the booked block landing with the physical spring. Below
it, the appointment in `data`. Under reduced motion, all of it renders in final position
with no animation. Keep the existing `confirmationEmailSent` three-way logic and its copy
intent.

**Branding override.** Implement `lib/brand-color.ts` and apply the client accent as inline
`--lume` and `--lume-ink` CSS variables on the flow root in `layout.tsx`, per `DESIGN.md`
section 2.4. Delete the `accentStyle` threading from the page and `TimeSlotGrid`. Add
Vitest coverage for the luminance and contrast-lift helpers; they are pure functions and
this repo tests pure functions.

**Done when:** all four steps render at 375px and 1280px, the conflict path and the
dismissible load-error banner still work, and the flow is completable by keyboard alone
with a visible focus ring at every stop.

---

## Phase 4: dashboard shell

`DashboardNav`, `DashboardChrome`, the signed-out state in `app/dashboard/layout.tsx`,
`CollaboratorBanner`, `OnboardingTour`.

Sidebar is 224px, `surface` on `canvas`, separated by a `hairline` right border. Active
nav item is a 2px `lume` left rail plus `bg-lume/8`, not a filled pill. Group headings in
`label` at `text-3`. Wordmark in `display-sm`. The mobile top bar and drawer keep their
current structure and their full account block; only the styling changes.

Signed-out state: center the wordmark, one sentence, one `SignInButton`. The admin-login
testing warning keeps its `rose` treatment because it is a real warning.

**Done when:** the nav renders on one line per item with no wrap at 1024px, the drawer
opens and closes, and the tier lock pills read correctly at all three tiers.

---

## Phase 5: dashboard home

`app/dashboard/page.tsx`.

**Booking link card.** Promote it. This is the single most useful thing on the page and it
currently looks like a footnote. Full width, `surface`, link in `data` with a proper copy
button that confirms in place.

**Stat row.** Drop the card boxes. Three stats in a row on `canvas`, value in `data-xl`,
caption in `label` at `text-2`, separated by vertical `hairline` rules. Pending errors
turns `rose` when non-zero. Bare stats read better at this density than three boxes, and it
breaks the three-equal-cards pattern.

**Upcoming.** Add a `DayStrip` for today above the list. The list itself stays as
`AppointmentCard` rows.

**Setup nudges and premium features.** Keep both, restyle. The premium list drops the `🔒`
emoji for a Phosphor lock. Free-tier gating logic is untouched.

---

## Phase 6: dashboard time

`app/dashboard/schedule/page.tsx` and `app/dashboard/calendar/page.tsx`. This is where the
Lightline pays off: a real now indicator that tracks the clock and scrolls into view on
load. Day cells follow the availability-is-light rule. Confirmed and conflict use `jade`
and `rose` rails.

---

## Phase 7: dashboard setup

`app/dashboard/reasons/page.tsx`, `app/dashboard/rules/page.tsx`, `RuleEditor`. These are
the densest forms in the app. Density 6: tight spacing, `hairline` dividers instead of
nested cards, no decorative anything. Every field label above its input.

---

## Phase 8: dashboard data

`analytics`, `errors`, `export`.

Analytics keeps its hand-rolled bars. Single series in `lume`, second series in `ice`, all
values in `data-sm`, track in `surface-2`. Keep the always-visible value labels and the
scroll-affordance edge fade; both were deliberate mobile fixes. Section headings move from
uppercase-tracked captions to `display-sm`.

Errors and export are small pages; restyle and move on.

---

## Phase 9: dashboard account

`branding`, `reminders`, `billing`, `team`, `calendars`. Mostly forms and lists against the
primitives from Phase 1. `PremiumLockCard` becomes a genuinely good locked state: what the
feature does, what it costs, one button.

On `branding`, the accent color picker should now preview against the real dark canvas and
warn when a chosen color fails the 4.5:1 floor from `lib/brand-color.ts`.

---

## Phase 10: marketing page

Build this **last**. The hero is a live `DayStrip`, so it cannot exist until Phase 2 does.

Dials for this surface: variance 8, motion 7, density 3.

### Structure

Six sections, five distinct layout families, no family repeated.

**Nav.** Single line, 64px, `canvas` with a `hairline` bottom border on scroll only.
Wordmark left, one CTA right. Never two lines.

**1. Hero, asymmetric split.** `min-h-[100dvh]`, `pt-24` maximum. Left column: H1, one
subtext line, one CTA. Right column: the live `DayStrip` in a `rounded-2xl` `surface` panel
with the Lightline moving. Four text elements maximum. No trust strip, no tagline under the
CTA, no version pill, no scroll cue.

Draft copy, replace if you have better:

- H1: `Your open hours, and nothing else.`
- Subtext: `Set your availability rules once, share one private link, and visitors can only book the time you opened.` (19 words)
- CTA: `Client sign in`

**2. The guarantee, full-bleed statement over photography.** One claim: two people cannot
book the same slot, because the database decides, not the app. Set over a full-bleed night
photograph graded to the canvas hue at low opacity. Inline micro-demo: two booking attempts
race for one slot, one resolves to booked and one to "that slot just went", using the real
conflict copy. This is the page's single storytelling animation.

Photography: this is the one place a photo appears on the page, which is why it lands. Use
a real image. Placeholder `https://picsum.photos/seed/gather-night-window/2400/1000` with a
`TODO` comment to replace, or regrade `public/tetons.jpg` to the canvas hue. Do not ship a
gradient blob in its place.

**3. How the rules work, split with real UI.** Left: a real, non-interactive `RuleEditor`
preview showing one populated rule. Right: three rule capabilities in a vertical stack
separated by `hairline` rules. Not cards.

**4. What the visitor sees, horizontal scroll-snap.** The four booking steps as real
rendered panels in a snap track. This is the only horizontal-scroll device on the page.

**5. Plans, asymmetric trio.** Three tiers, three cells, deliberately unequal: Premium is
the recommended tier and gets the taller lit card with `glow`; Free and Elite are quieter
`surface` cards. Three tiers is real parallel content so three cells is correct, but they
must not be three identical boxes.

**6. Footer.** Wordmark, one CTA with the same label as everywhere else, legal line. No
version string, no locale strip, no weather.

### Hard constraints for this page

- One accent. `lume` and neutrals only. No jade, rose, or ice anywhere on `/`.
- Zero eyebrows. Six sections would permit two, but the headlines carry it and every AI
  landing page has an eyebrow above every section. Skip them entirely.
- One CTA intent, one label. `Client sign in` in the nav, the hero, and the footer. Not
  "Get started" in one place and "Sign in" in another.
- Hero H1 fits two lines at desktop and the CTA is visible without scrolling.
- No fake screenshots built from divs. Every product visual on this page is a real
  component rendered with real-shaped data.
- No scroll cue, no marquee beyond the one snap track, no rotated text, no decorative
  status dots, no section numbering, no locale or time strip.
- Retire `animate-kenburns` and `animate-float`; both were tied to the old hero.

---

## Phase 11: documentation

Rewrite `theme_brand.md` to point at `.design/DESIGN.md` as the source of truth and
describe Nightshift, since `tailwind.config.js` references it by name and a stale brand doc
is worse than none. Update the styling section of `CLAUDE.md`. Delete references to Golden
Hour, Inter, Fraunces, and the old token names.

---

## Verification harness

Add `scripts/design-shots.mjs`. It should start the dev server, walk a list of routes,
screenshot each at 1280x900 and 375x812, write to `.design/screenshots/{surface}-{width}.png`,
and shut down cleanly. Playwright with Chromium is already available in this environment;
do not run `playwright install`.

Routes to capture: `/`, `/visit/{seeded-link}` at each of the four steps, `/dashboard`, and
each dashboard route. `npm run db:seed` produces a test client and prints the booking link.

Add `.design/screenshots/` to `.gitignore`.

**Look at the screenshots.** Capturing them and not reading them is not verification.

---

## Pre-flight checklist

Run before marking any phase done. Adapted from the design-taste-frontend pre-flight;
landing-page-only items are marked so they can be skipped on product surfaces.

**Every phase**

- [ ] Zero em-dashes and zero en-dash separators in any user-visible string
- [ ] Page theme locked dark; no section inverts
- [ ] One accent; status colors only where they encode real state
- [ ] One radius system per `DESIGN.md` section 4, no mixed radii inside a component
- [ ] Glow appears only on the Lightline, available time, the in-view primary CTA, and
      focus rings
- [ ] Every button's label is readable against its fill at 4.5:1 or better
- [ ] Every CTA label fits one line at desktop
- [ ] Inputs, placeholders, labels, helper text, and error text all pass AA against their
      actual background
- [ ] Focus ring visible on every interactive element, keyboard path complete
- [ ] Loading, empty, and error states all exist and are all styled
- [ ] `prefers-reduced-motion` honored; animations degrade to static, not to broken
- [ ] Motion is `transform` and `opacity` only; no `window.addEventListener('scroll')`;
      no continuous values in `useState`
- [ ] Motion components are `'use client'` leaves with `useEffect` cleanup
- [ ] Icons from Phosphor only; no emoji, no hand-rolled SVG paths
- [ ] `min-h-[100dvh]`, never `h-screen`
- [ ] Mobile collapse declared explicitly per multi-column layout
- [ ] Every existing `aria-*` attribute and always-visible action preserved
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` all clean
- [ ] Screenshots captured at 1280 and 375, and actually reviewed

**Marketing page only**

- [ ] Nav on one line at 1024px, 80px tall maximum
- [ ] Hero: 4 text elements maximum, H1 at most 2 lines, subtext at most 20 words, CTA
      visible without scrolling, `pt-24` maximum
- [ ] Zero eyebrows
- [ ] No two sections share a layout family; no 3 consecutive image-and-text splits
- [ ] No duplicate CTA intent; one label per intent across the whole page
- [ ] Real images or real component previews only; no div-based fake screenshots, no
      hand-rolled decorative SVG, no pure-text section standing in for a visual
- [ ] No scroll cue, no version label, no section numbering, no locale or weather strip,
      no photo-credit captions, no decorative dots, at most one horizontal scroll device
- [ ] Copy self-audit: every visible string re-read for grammar, clear referents, and
      accidental AI cuteness

If a box cannot honestly be ticked, the phase is not done.

# Design System: Gather "Nightshift"

> Source of truth for every visual decision in this app. `tailwind.config.js` and
> `app/globals.css` implement this file. If they disagree, this file wins and the code
> gets fixed. Replaces the previous "Golden Hour" system documented in `theme_brand.md`.

---

## 0. Design read

Reading this as: a redesign-overhaul of a scheduling product with three distinct surfaces
(a marketing landing page, a visitor booking flow, and an operator dashboard), for solo
practitioners and the people who book with them, with a dark-canvas luminous language,
leaning toward Tailwind v3 utilities driven by CSS variables, Motion for animation, and
Phosphor for icons.

Mode: **redesign - overhaul.** Visual language is replaced. Content, information
architecture, route slugs, form field names, and copy voice on the product side are
preserved unless this document says otherwise.

### Dials, per surface

The three surfaces have genuinely different jobs, so they get different dials rather than
one global setting.

| Surface | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY |
|---|---|---|---|
| Marketing (`/`) | 8 | 7 | 3 |
| Booking flow (`/visit/[clientLink]`) | 5 | 5 | 4 |
| Dashboard (`/dashboard/*`) | 3 | 3 | 6 |

Existing site reads as variance 3, motion 4, density 5. Marketing and booking get pushed;
the dashboard deliberately does not, because dense operator UI is not a landing page and
gets worse when treated like one.

---

## 1. The concept

**Gather protects time. On a dark ground, time you have given away is dark and matte.
Time you can still have is lit.**

This is why the app is dark. It is not dark because dark is modern. It is dark because
the product's single job is telling you, at a glance, which hours are still yours, and
light against darkness is the most legible way a screen can say that. A cream page cannot
make this distinction without inventing an arbitrary color code.

Everything downstream follows from it:

- Available time glows. Booked time does not.
- The primary accent is the color of a lit window at night, not a tech neon.
- Motion is used for one thing above all: showing time moving.

### 1.1 The signature: The Lightline

A single 1px horizontal rule in the accent color with a soft bloom, representing **now**.

It appears in exactly three places, and it is the same object in all three:

1. **Marketing hero.** A live `DayStrip` component showing one real day as a horizontal
   band: matte blocks where time is booked, lit gaps where it is open, and the Lightline
   sitting at the current time. It moves. This is the hero visual and the page's thesis.
2. **Dashboard Schedule and Calendar day views.** A real "now" indicator that tracks the
   clock and scrolls into view on load.
3. **Booking flow step rail.** The four-step progress indicator is not numbered circles.
   It is a Lightline track that fills with accent as the visitor advances.

**Glow discipline.** Glow is semantic, never decorative. Only four things in the entire
app are allowed to carry a glow shadow:

1. The Lightline itself
2. Available and selectable time (slot chips, open day cells)
3. The single primary call to action currently in view
4. Focus rings

If a surface, badge, icon, card, heading, or divider glows, that is a bug. Write it down
in review and remove it.

---

## 2. Color

Defined as CSS custom properties in `app/globals.css` on `:root`, and consumed by
`tailwind.config.js`. Each color is declared twice: once as a hex for direct use, and once
as a space separated RGB triple so Tailwind's `<alpha-value>` syntax works for tints.

```css
:root {
  color-scheme: dark;

  /* Canvas and structure */
  --void:         #08090F;  --void-rgb:        8 9 15;
  --canvas:       #0D0F17;  --canvas-rgb:     13 15 23;
  --surface:      #141826;  --surface-rgb:    20 24 38;
  --surface-2:    #1B2032;  --surface-2-rgb:  27 32 50;

  /* Lines. Three roles, do not mix them up. */
  --hairline:     #242A3C;  --hairline-rgb:   36 42 60;
  --hairline-2:   #333B52;  --hairline-2-rgb: 51 59 82;
  --edge:         #5D688A;  --edge-rgb:       93 104 138;

  /* Text */
  --text:         #E9EBF4;  --text-rgb:      233 235 244;
  --text-2:       #9AA1BA;  --text-2-rgb:    154 161 186;
  --text-3:       #626A85;  --text-3-rgb:     98 106 133;

  /* Accent. The only thing that glows. */
  --lume:         #FFB454;  --lume-rgb:      255 180 84;
  --lume-2:       #FFD199;  --lume-2-rgb:    255 209 153;
  --lume-ink:     #1A1206;  --lume-ink-rgb:   26 18 6;

  /* Status. Product surfaces only. Encodes state, never decoration. */
  --jade:         #4FD6A4;  --jade-rgb:       79 214 164;
  --rose:         #FF7286;  --rose-rgb:      255 114 134;
  --ice:          #79ADFF;  --ice-rgb:       121 173 255;

  /* Motion */
  --ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1);
}
```

### 2.1 Roles

| Token | Role |
|---|---|
| `void` | Page root behind everything, modal scrim base, ink on status fills |
| `canvas` | App background, the default ground |
| `surface` | Cards, sidebar, panels, nav |
| `surface-2` | Raised things: modals, popovers, inputs, hover fills, booked blocks |
| `hairline` | Decorative dividers and card outlines that carry no information |
| `hairline-2` | Emphasized dividers, table rules, section separators |
| `edge` | Boundary of any interactive control. Inputs, selects, secondary buttons, unselected slot chips. Meets the 3:1 non-text contrast requirement against both `canvas` and `surface`; `hairline` does not, so never use `hairline` as a control border |
| `text` | Headings and body |
| `text-2` | Secondary text and metadata |
| `text-3` | Disabled and placeholder only. Below AA for body text by design; never use it for content a person has to read |
| `lume` | Primary accent. CTAs, selected state, available time, links, wordmark, the Lightline |
| `lume-2` | Accent text on dark grounds, hover brightening |
| `lume-ink` | Text and icons on top of a `lume` fill |
| `jade` | Confirmed and successful state |
| `rose` | Conflict, error, destructive |
| `ice` | Informational, secondary data series, shared/collaborator affordances |

### 2.2 Accent lock

**Marketing page: one accent.** `lume` plus neutrals only. No jade, rose, or ice anywhere
on `/`. A landing page with four accent colors reads as a component gallery.

**Product surfaces: one accent plus a semantic status set.** `lume` is the only decorative
or emphatic color. `jade`, `rose`, and `ice` may appear *only* where they encode real
state, and each maps to exactly one meaning app-wide:

- `jade` = confirmed
- `rose` = conflict, error, destructive action
- `ice` = informational, or "belongs to someone else" (shared calendars, collaborators)

Never use a status color because a layout needed variety.

### 2.3 Verified contrast

All values computed against the stated background. Body text targets AAA, non-text UI
boundaries target 3:1 per WCAG 1.4.11.

| Pair | Ratio | Result |
|---|---|---|
| `text` on `canvas` | 16.08 | AAA |
| `text-2` on `canvas` | 7.45 | AAA |
| `text-2` on `surface` | 6.88 | AA |
| `lume` on `canvas` | 10.85 | AAA |
| `lume` on `surface` | 10.02 | AAA |
| `lume-2` on `surface` | 12.48 | AAA |
| `lume-ink` on `lume` | 10.51 | AAA (this is the primary button pairing) |
| `jade` on `canvas` | 10.46 | AAA |
| `rose` on `canvas` | 7.29 | AAA |
| `ice` on `canvas` | 8.41 | AAA |
| `void` on `jade` / `rose` / `ice` | 10.87 / 7.58 / 8.74 | AAA (ink on status fills) |
| `edge` vs `canvas` | 3.47 | passes 1.4.11 |
| `edge` vs `surface` | 3.21 | passes 1.4.11 |
| `text-3` on `surface-2` | 3.02 | disabled and placeholder only |

Any new color added to this system must be checked the same way before it ships.

### 2.4 Per-client branding override

Premium clients set a custom accent hex that currently gets patched onto the booking page
as inline `backgroundColor` styles on a handful of controls. Under Nightshift that
approach breaks: an arbitrary client hex may be unreadable on a dark ground, and the
inline patch leaves the rest of the page on the default accent.

Replacement: `app/visit/[clientLink]/layout.tsx` sets `--lume` (and a computed
`--lume-ink`) as inline CSS variables on the flow's root element. Every control inherits
the client accent automatically, and the inline `accentStyle` prop threading through
`TimeSlotGrid` and the page can be deleted.

Two guards, both required:

1. **Readable ink.** Compute the client accent's relative luminance at render time and set
   `--lume-ink` to `--void` when the accent is light and `#FFFFFF` when it is dark. Do not
   assume dark ink.
2. **Minimum contrast against the canvas.** If the client accent scores below 4.5:1 on
   `--canvas`, lighten it programmatically until it passes rather than rendering an
   unreadable page. Put this in a small `lib/brand-color.ts` with unit tests, since it is
   pure logic and the repo already tests pure functions with Vitest.

---

## 3. Typography

Three families, three jobs, no overlap. The outgoing Inter and Fraunces pairing is
removed entirely.

| Role | Family | Weights | Loaded via |
|---|---|---|---|
| Display | Space Grotesk | 500, 700 | `next/font/google` |
| UI and body | Geist Sans | 400, 500, 600 | the `geist` npm package |
| Data | Geist Mono | 400, 500 | the `geist` npm package |

**Load Geist from the `geist` package, not `next/font/google`.** This project is on Next
14.2, whose bundled Google Fonts data predates Geist's addition to Google Fonts, so
`next/font/google` will fail to resolve it. The official `geist` package (v1.7.x) exports
`geist/font/sans` and `geist/font/mono` and works from Next 13.4 up. Space Grotesk is
long established in Google Fonts and loads normally through `next/font/google`.

### 3.1 Why these

Display needs character without costume. Space Grotesk's tight apertures and slightly
odd terminals give headings a voice at large sizes and stay quiet at small ones. It is not
a serif, because nothing about a scheduling tool is editorial or heritage, and the
outgoing Fraunces was reaching for a boutique-studio feeling the product does not have.

The data face is the real decision. Times, dates, durations, counts, and stats appear on
nearly every screen in this app, and they are the content. Setting all of them in Geist
Mono with tabular figures means columns of times align, a duration is instantly
recognizable as a value rather than a word, and the interface reads as precise. **Mono
means "this is a value."** That rule is the typographic half of the signature.

### 3.2 Scale

Defined in `tailwind.config.js` under `fontSize` as `[size, { lineHeight, letterSpacing, fontWeight }]`
tuples so the scale is used by name and never improvised.

| Name | Size / line height | Family | Use |
|---|---|---|---|
| `display-xl` | 56px / 1.0, `-0.03em`, 700 | Space Grotesk | Marketing hero H1 only |
| `display-lg` | 40px / 1.05, `-0.02em`, 700 | Space Grotesk | Marketing section headings |
| `display-md` | 28px / 1.15, `-0.02em`, 700 | Space Grotesk | Dashboard and booking page H1 |
| `display-sm` | 20px / 1.2, `-0.01em`, 500 | Space Grotesk | Card titles, modal titles, wordmark |
| `body` | 15px / 1.55, 400 | Geist Sans | Default body and UI text |
| `body-sm` | 13.5px / 1.5, 400 | Geist Sans | Secondary and helper text |
| `label` | 12px / 1.3, `0.04em`, 500 | Geist Sans | Field labels, nav group headings, stat captions |
| `micro` | 11px / 1.2, 500 | Geist Sans | Badges, tier pills |
| `data-xl` | 32px / 1.0, 500, tabular | Geist Mono | Big stat numbers |
| `data` | 14px / 1.2, 400, tabular | Geist Mono | Times, dates, durations, counts inline |
| `data-sm` | 12px / 1.2, 400, tabular | Geist Mono | Dense table and chart values |

`display-xl` steps down to 40px below `md`. Marketing hero H1 is capped at 2 lines on
desktop; if the copy will not fit, the copy gets cut, not the scale.

**Emphasis rule.** To emphasize a word inside a heading, use weight or italic of the same
family. Never drop a second family into a headline for visual interest.

### 3.3 Where mono is mandatory

Every clock time, date, duration, slot count, appointment count, stat value, phone number,
booking link, and chart axis value. If it is a value a person might compare against
another value, it is mono. Reason names, rule names, visitor names, and prose are not.

---

## 4. Shape

One radius system, applied everywhere, with a documented rule.

| Radius | Value | Applies to |
|---|---|---|
| `rounded-lg` | 10px | Buttons, inputs, selects, slot chips, day cells, nav items, badges that are not pills |
| `rounded-xl` | 14px | Cards, panels, callouts |
| `rounded-2xl` | 20px | Modals, the booking shell, the marketing hero panel |
| `rounded-full` | full | Status pills, tier badges, avatars, toggle pills. Nothing else |

Mixed radii inside one component are a bug. A `rounded-lg` button inside a `rounded-xl`
card is correct; a `rounded-full` button inside that same card is not.

---

## 5. Depth: elevation and glow are different things

Two separate shadow families. Do not combine them on the same element except on the
primary CTA, which is allowed both.

**Elevation** lifts a surface off the ground. Neutral, black based, no hue.

```js
lift1: '0 1px 2px 0 rgb(0 0 0 / 0.55)',
lift2: '0 8px 24px -6px rgb(0 0 0 / 0.6), 0 2px 6px -2px rgb(0 0 0 / 0.45)',
lift3: '0 24px 64px -12px rgb(0 0 0 / 0.7), 0 8px 20px -8px rgb(0 0 0 / 0.5)',
```

`lift1` on cards, `lift2` on popovers and hovered cards, `lift3` on modals only.

**Glow** marks time you can have. Accent tinted, and governed by the glow discipline in
section 1.1.

```js
glowSm: '0 0 0 1px rgb(var(--lume-rgb) / 0.28), 0 0 10px -2px rgb(var(--lume-rgb) / 0.32)',
glow:   '0 0 0 1px rgb(var(--lume-rgb) / 0.4),  0 0 22px -4px rgb(var(--lume-rgb) / 0.42)',
glowLg: '0 0 0 1px rgb(var(--lume-rgb) / 0.5),  0 0 48px -8px rgb(var(--lume-rgb) / 0.5)',
```

There is no `glow` variant for jade, rose, or ice. Status colors do not glow.

**Focus.** One treatment app-wide: `outline: 2px solid var(--lume); outline-offset: 2px`,
applied through `focus-visible`. Never remove it, never replace it with a color change
alone.

---

## 6. Motion

Library: **Motion**, imported as `motion/react` (package name `motion`). GSAP is not
needed and must not be added; nothing here requires scroll pinning or scrub.

| Band | Duration | Easing | Use |
|---|---|---|---|
| Instant | 120ms | `--ease-out` | Hover, press, color change |
| Quick | 200ms | `--ease-out` | State change, toggle, tab switch |
| Enter | 420ms | `--ease-out` | Content and section entrance |
| Physical | spring `{ stiffness: 260, damping: 26 }` | n/a | Anything that should feel like an object landing |
| Ambient | 4s and up, loop | `--ease-in-out` | The Lightline bloom only |

Rules:

- Animate `transform` and `opacity` only. Never `top`, `left`, `width`, `height`.
- `window.addEventListener('scroll')` is banned. Use `useScroll` from `motion/react`,
  `IntersectionObserver`, or `whileInView`.
- Never drive a continuous value through `useState`. Use `useMotionValue` and
  `useTransform`.
- Every animation must be justifiable in one sentence as hierarchy, storytelling,
  feedback, or state transition. "It looked good" means delete it.
- Any component using Motion is a `'use client'` leaf.

**Reduced motion is mandatory.** Wrap with `useReducedMotion()` and degrade to static.
The Lightline stops pulsing but stays visible and stays in the right position. The booking
confirmation lands instantly instead of springing. No exceptions.

The three animations that earn their place:

1. **The Lightline bloom.** A slow ambient pulse on the now indicator. Justification: it
   is the only element on screen representing something that is actually changing.
2. **The booking confirmation.** The step rail completes and the new appointment block
   drops into the day strip with a spring. Justification: it is the one moment in the flow
   worth marking, and it shows the visitor what they just did to the client's day.
3. **Marketing scroll reveals.** `whileInView` stagger on section entrance, once only.
   Justification: sequences the argument the page is making.

Everything else is hover, press, and focus feedback.

---

## 7. Component specifications

### Button

Variants and their exact treatment. Every one has hover, active, disabled, and
focus-visible states, and every one keeps its label on a single line at desktop.

| Variant | Rest | Hover | Active | Disabled |
|---|---|---|---|---|
| `primary` | `bg-lume text-lume-ink`, `shadow-glow` when it is the CTA in view | `bg-lume-2` | `scale-[0.98]` | `bg-lume/25 text-text-3`, no glow |
| `secondary` | `bg-surface-2 text-text border border-edge` | `bg-surface-2` brightened, `border-lume/40` | `scale-[0.98]` | `opacity-50` |
| `ghost` | `text-text-2`, no fill | `bg-lume/8 text-text` | `scale-[0.98]` | `opacity-50` |
| `danger` | `bg-rose text-void` | `bg-rose` brightened | `scale-[0.98]` | `opacity-50` |

Minimum target 44px tall, `rounded-lg`, `body-sm` weight 500. Primary CTA labels are one
to three words.

### Card

`bg-surface`, `border border-hairline`, `rounded-xl`, `shadow-lift1`. Hoverable variant
adds `shadow-lift2` and `border-hairline-2` at 200ms. Cards never glow.

Prefer no card at all where spacing or a `hairline` divider does the same job. The
dashboard currently boxes things that do not need boxing; see the stat row spec below.

### Input, Select, Textarea

`bg-surface-2`, `border border-edge`, `rounded-lg`, `text` at `body`, placeholder at
`text-3`. Label above at `label`, error below at `body-sm` in `rose`. Focus uses the
global focus ring. Error state swaps the border to `rose`. Never use a placeholder as a
label.

Because `color-scheme: dark` is set, native date pickers, scrollbars, and autofill render
dark automatically. Verify autofill on Chrome specifically; it is the usual offender.

### Badge

`rounded-full`, `micro`, `px-2.5 py-0.5`. Tones map to the status set: `neutral`
(`bg-text-2/12 text-text-2`), `accent` (`bg-lume/14 text-lume-2`), `jade`, `rose`, `ice`
(each `bg-<color>/14 text-<color>`). Badges never glow.

### Slot chip (`TimeSlotGrid`)

The clearest expression of the concept, so get it exactly right.

| State | Treatment |
|---|---|
| Available | `bg-lume/8 border border-lume/30 text-lume-2`, time in `data` |
| Available, hovered | `bg-lume/14`, `shadow-glowSm`, 120ms |
| Selected | `bg-lume text-lume-ink`, `shadow-glow` |
| Unavailable | `bg-surface border border-edge text-text-3`, `cursor-not-allowed`, no glow |

Add a count above the grid: "8 open" in `data`, `text-2`. It costs nothing and tells the
visitor whether to bother scanning.

### Day cell (`Calendar`)

Same logic in a grid. Has availability: `text` and a faint `border-lume/20`. No
availability: `text-3`, `border-hairline`. Selected: `bg-lume text-lume-ink`. Confirmed
appointments show a 2px `jade` underline rather than a dot; conflicts show `rose`. Keep
the existing `aria-label` composition exactly as written; it is already correct and is the
only description a screen reader user gets.

### Appointment block (`AppointmentCard`)

`bg-surface-2`, `rounded-lg`, with a 2px left rail: `jade` when confirmed, `rose` when
red flagged. Conflict adds a `bg-rose/8` wash. Time in `data` at the top left, visitor
name in `body`, reason in `body-sm` `text-2`. Keep the existing always-visible Details
and Edit controls; do not regress them to hover-only.

### Lightline

New shared component, `components/Lightline.tsx`.

```
props: { orientation?: 'horizontal' | 'vertical', at: number /* 0..1 */, label?: string }
```

Renders a 1px `lume` rule at the given fraction, with a `glowSm` bloom and an optional
`data-sm` label chip at the leading edge. Ambient pulse via Motion, disabled under
reduced motion. Positioned with `transform`, never `top`.

### DayStrip

New shared component, `components/DayStrip.tsx`. One day rendered as a horizontal band:
matte `surface-2` blocks for booked time, `lume/8` for open time, hour ticks in
`hairline`, and a `Lightline` at the current time. Used on the marketing hero with real
shaped data and on the dashboard as a day overview. Building it once and using it in both
places is what keeps the marketing page honest: the hero is a real product component, not
a drawing of one.

### Loading, empty, error

- **Loading.** Replace full page `<Spinner />` with `<Skeleton />` shaped like the content
  that is about to arrive. Skeleton is `bg-surface-2` with a slow shimmer, disabled under
  reduced motion. The spinner survives only for inline button-level pending states.
- **Empty.** Every empty state gets one sentence saying what goes here and one button that
  puts something there. Written as an invitation, not an apology.
- **Error.** Inline and specific. Say what failed and what to do. Errors do not apologize
  and are never vague.

---

## 8. Icons

`@phosphor-icons/react` v2, `weight="regular"` app-wide, `size={18}` for inline UI and
`size={20}` for nav. One family only.

This replaces every raw glyph and emoji currently used as an icon: `☰`, `←`, `→`, `✕`,
`↓`, `✓`, `?`, `i`, and the `🔒` in the premium features list. Emoji are not icons; they
render differently on every platform and carry no consistent weight. Do not hand roll SVG
paths; if a glyph is missing from Phosphor, compose it from primitives or pick a different
metaphor.

---

## 9. Copy

Product copy voice is preserved. The rules it already follows and must keep following:

- Name things by what the person controls, not how the system works.
- Active voice. A control says what happens: "Save changes", not "Submit".
- An action keeps its name through the whole flow. The button that says "Confirm booking"
  produces a confirmation that says "Booked".
- Sentence case everywhere. No title case headings, no shouting labels.
- One job per string. A label labels; an example demonstrates.

**Zero em-dashes and zero en-dash separators in any user-visible string.** Headlines,
labels, buttons, body, helper text, error text, empty states, alt text, and metadata. Use
a period, a comma, parentheses, a colon, or a plain hyphen. This applies to the shipped UI
only; existing source code comments are not user visible and can be left alone.

---

## 10. Explicitly not doing

- **No light theme.** The page theme is locked dark, top to bottom, on every surface. No
  section inverts. `color-scheme: dark` is declared so the browser agrees. A light variant
  is a separate future project, not part of this pass.
- **No new design system dependency.** No shadcn, Radix Themes, Material, or Carbon. This
  is Tailwind utilities over CSS variables, which is what the project already is.
- **No chart library.** The analytics bars are hand rolled and stay hand rolled. They
  restyle to `lume` as the single series with `ice` as the second, mono values, and no
  library.
- **No GSAP, no Three.js, no scroll hijacking.**
- **No changes to routes, slugs, API shapes, form field names, tier gating, data fetching,
  or the booking concurrency logic.** This is a presentation pass. `lib/booking.ts` and
  the Postgres functions are the highest risk code in the repo and are out of bounds.

---

## 11. Design system block

Copy this block verbatim into every design-loop baton prompt.

```
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
```

# Gather brand — "Nightshift"

This file is a pointer, not the source of truth. The actual design system — full color
rationale, contrast verification, typography scale, motion rules, and every component
spec — lives in **`.design/DESIGN.md`**, which `tailwind.config.js` and `app/globals.css`
implement directly. Read that file first. This page is a short summary for anyone who
lands here from the `tailwind.config.js` header comment without diving into `.design/`.

Nightshift replaced the previous "Golden Hour" warm/cream system (dismantled across
`.design/PLAN.md` phases 0-10 of the redesign). Golden Hour is gone: no `background`,
`accent`, `highlight`, or `text-primary`/`text-secondary` tokens remain anywhere in
`app/` or `components/`, and Inter/Fraunces were replaced by Space Grotesk/Geist. If you
find a stray reference to any of those, it's a bug, not a fallback.

## Palette

Dark, locked, no light mode. Booked time is dark and matte; open time is lit — see
`.design/DESIGN.md` section 1 for the concept, section 2 for the full token table and
verified contrast ratios.

| Token | Hex | Role |
|---|---|---|
| `canvas` | `#0D0F17` | app background |
| `surface` | `#141826` | cards, nav, panels |
| `surface-2` | `#1B2032` | modals, inputs, raised/hover surfaces |
| `hairline` / `hairline-2` | `#242A3C` / `#333B52` | decorative / emphasized dividers |
| `edge` | `#5D688A` | interactive control borders (meets 3:1) |
| `text` / `text-2` / `text-3` | `#E9EBF4` / `#9AA1BA` / `#626A85` | primary / secondary / disabled |
| `lume` / `lume-bright` / `lume-ink` | `#FFB454` / `#FFD199` / `#1A1206` | the only decorative accent |
| `jade` / `rose` / `ice` | `#4FD6A4` / `#FF7286` / `#79ADFF` | confirmed / conflict / informational, product surfaces only |

`lume` is the single accent. `jade`/`rose`/`ice` are semantic status colors, never
decoration, and never appear on the marketing page (`/`) at all — see `.design/DESIGN.md`
section 2.2.

## Typography

- **Display**: Space Grotesk, loaded via `next/font/google`, exposed as `--font-display`.
- **UI and body**: Geist Sans, loaded from the `geist` npm package (not `next/font/google`
  — this project is on Next 14.2, whose bundled Google Fonts data predates Geist), exposed
  as `--font-sans`.
- **Data**: Geist Mono, same package, exposed as `--font-mono`. Mandatory for every clock
  time, date, duration, count, stat, phone number, booking link, and chart axis value —
  see `.design/DESIGN.md` section 3.3.
- Named type scale (`display-xl` through `micro`, `data-xl` through `data-sm`) defined in
  `tailwind.config.js`'s `fontSize` block — use the named sizes, never improvise a raw
  Tailwind text size.

## Shape & elevation

One radius system, applied everywhere: `rounded-lg` (10px) for controls, `rounded-xl`
(14px) for cards/panels/callouts, `rounded-2xl` (20px) for modals and the booking shell,
`rounded-full` for pills only. Two separate shadow families — neutral `lift1`/`lift2`/
`lift3` for elevation, accent-tinted `glowSm`/`glow`/`glowLg` for the four things allowed
to glow (the Lightline, available time, the in-view primary CTA, focus rings). Full detail
in `.design/DESIGN.md` sections 4-5.

## Motion

`motion` (imported as `motion/react`), not CSS-only. Transform and opacity only, reduced
motion mandatory. Full rules and the three animations that earn their place (the Lightline
bloom, the booking confirmation, marketing scroll reveals) in `.design/DESIGN.md` section 6.

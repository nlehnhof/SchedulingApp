# Gather brand — "Golden Hour"

This is the design-system reference `tailwind.config.js` points to. It was missing from the
repo (lost or never committed) until this pass reconstructed it from the palette already in
use — treat this as the current source of truth going forward.

## Palette

A warm, low-saturation palette — cream/parchment backgrounds, a terracotta accent, muted
ink-brown text. The name "Golden Hour" refers to that terracotta-on-cream warmth, meant to feel
more like a boutique studio than a generic SaaS dashboard.

| Token | Hex | Role |
|---|---|---|
| `background` | `#FDF9F4` | page background |
| `surface` | `#FFFDFB` | cards, nav, modals, inputs |
| `border` | `#EFE3D2` | all borders |
| `text-primary` | `#2E2620` | body/heading text |
| `text-secondary` | `#7A6F60` | secondary/meta text |
| `accent` | `#C4693A` | primary actions, selected states, links |
| `accent-hover` | `#A8552C` | hover state of accent |
| `accent-soft` | `#E3C9A0` | tints — used as `bg-accent-soft/10..40` for subtle backgrounds |
| `highlight` | `#4F7A72` | secondary emphasis — badges, info callouts, alternate chart series |
| `highlight-hover` | `#3D6058` | hover state of highlight |
| `highlight-soft` | `#CBE0DA` | tints, same usage pattern as accent-soft |
| `success` | `#6B7A4F` | confirmed/positive status |
| `danger` | `#B84B3D` | errors, destructive actions, conflicts |

`highlight` was added alongside the original single-accent palette so the app isn't
monochrome — a second, distinct hue for anything that shouldn't compete with the primary accent
(status badges, secondary chart series, info affordances) while staying inside the same muted,
low-saturation "Golden Hour" family rather than introducing a jarring bright color.

No dark mode variant exists yet.

## Typography

- **Sans (body/UI)**: Inter, loaded via `next/font/google` in `app/layout.tsx`, exposed as
  `--font-inter`.
- **Serif (headings, wordmark)**: Fraunces (weights 500/600/700), same mechanism, exposed as
  `--font-fraunces`. Used for page `<h1>`s, modal titles, and the "Gather" wordmark — never for
  body copy or form labels.
- No custom type scale is defined — stock Tailwind sizes (`text-xs` through `text-5xl`) are used
  directly, skewed toward `text-sm` for body/UI text.

## Shape & elevation

- Inline controls (buttons, inputs, selects) stay `rounded-md` — enough softening without making
  small tap targets feel mushy.
- Cards, modals, and other standalone surfaces use `rounded-xl`/`rounded-2xl` — rounder than
  controls, part of moving the app away from a flat/blocky look.
- `shadow-soft` / `shadow-medium` (custom `boxShadow` tokens, warm-tinted rather than Tailwind's
  default cool gray) give cards and modals real elevation — previously the dashboard had almost
  no shadow usage anywhere and read as flat borders-on-cream.

## Motion

Tailwind/CSS only, no animation library. Custom keyframes live in `tailwind.config.js`:

- `animate-fade-up` — entrance for content blocks (originally marketing-page-only, now a shared
  utility).
- `animate-scale-in` — entrance for modals/popovers.
- `animate-slide-in` — entrance for the mobile nav drawer and similar off-canvas panels.
- `animate-kenburns` / `animate-float` — marketing hero-specific, not for general reuse.

Motion should stay subtle (short durations, `cubic-bezier(0.16, 1, 0.3, 1)` "ease-out-expo" feel)
— this is a scheduling tool people use to get things done, not a showcase.

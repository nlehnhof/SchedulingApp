---
page: dashboard-data
layout: foundation
phase: 8
---

Restyle `app/dashboard/analytics/page.tsx`, `app/dashboard/errors/page.tsx`, and
`app/dashboard/export/page.tsx` against the Nightshift system. Read `.design/DESIGN.md` in
full and `.design/PLAN.md` Phase 8 before starting, and read each file in full first (they're
small) — restyle in place rather than rearchitecting the data fetching or the hand-rolled bar
charts.

**Scope, exactly:**

1. **`app/dashboard/analytics/page.tsx`.** Keep the hand-rolled bars; no chart library
   (`DESIGN.md` section 10 is explicit about this). Single series in `lume`, a second series
   in `ice` where one exists (there currently isn't a true second series in this file's data —
   verify against the fetched `AnalyticsData` shape before inventing one; if every chart here
   is genuinely single-series, `ice` simply doesn't get used on this page, which is fine).
   - `BarRow`'s per-bar value labels (`text-[10px]`) and axis labels → `data-sm` (mono, per
     `DESIGN.md` section 3.3: these are stat values). Keep them always-visible (not
     hover/title-only) and keep the scroll-affordance edge fade on `BarRow` — both are
     deliberate mobile fixes noted in the existing comments, not decoration to remove.
   - The "Most-booked reasons" bar track (`bg-hairline`) → `surface-2` per the plan's "track in
     surface-2" instruction; the fill stays `lume`. That count value → `data-sm`.
   - `Section`'s heading treatment (currently an uppercase-tracked caption) → `display-sm`,
     per the plan ("Section headings move from uppercase-tracked captions to display-sm" is
     specific to this phase, unlike the `label`-caption treatment used on earlier surfaces).
   - Page `h1` → `display-md` (matches every other dashboard page h1 as of Phases 5-7). The
     "Last N days · N appointments" subline: the `·` separator is fine (not a banned
     dash), just retype to `body-sm`, and put both counts in `data`/mono since they're stat
     values.
   - Status-breakdown and reason-popularity list rows: retype `text-sm`/raw sizes to
     `body`/`body-sm`, counts to `data-sm` mono.
   - `PremiumLockCard` usage and the 403-detection logic are untouched (presentation-only
     phase; don't touch the error-message sniffing).
2. **`app/dashboard/errors/page.tsx`.** Small page. `h1` → `display-md`, empty/error/loading
   states → `body-sm`. `ErrorBanner` itself is already restyled (Phase 1) — don't touch it.
3. **`app/dashboard/export/page.tsx`.** `h1` → `display-md`. The confirm callout
   (`border-lume/40 bg-lume/25`) → bump radius to the documented system (`rounded-xl`, it's a
   callout). Retype `text-sm` → `body-sm`. **Fix the em-dash** in "email a CSV of {month}'s
   appointments to your account email — continue?" (use a question on its own sentence, e.g.
   ending the statement with a period and asking "Continue?" separately, or a colon). Also fix
   "Sent — {message}" the same way.

**Out of bounds:** routes, API shapes, form field names, SWR keys, tier gating logic, anything
under `lib/booking.ts` or `supabase/`. Don't touch `ErrorBanner.tsx` (already Phase 1) or the
analytics 403-detection/premium-gating logic.

**Done when:** all three pages render correctly at 375px and 1280px, the analytics bar charts'
value labels stay visible without hover/tap, the horizontal-scroll edge fade on `BarRow` still
works, a grep for em-dash/en-dash separators across all three files returns nothing outside
comments, `npx tsc --noEmit` is clean, `npm run lint` is clean, and `npm test` passes.

**Before finishing, write the Phase 9 baton to `.design/next-prompt.md`** using
`.design/PLAN.md` Phase 9 as the body, with the design system block below copied in, and mark
`dashboard-data` complete in `.design/SURFACES.md` section 4. If you skip this, the loop
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

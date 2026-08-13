-- Adds first-run onboarding tracking and a feature-flag-only premium tier,
-- plus the branding/slug columns the premium tier's first two features need
-- (custom booking-page branding + a short custom slug). All additive,
-- nullable-or-defaulted columns — safe to run against a live table with
-- existing rows. See PLAN.md Sections 3 and 4.
--
-- tutorial_completed_at: server-side "seen the first-run tour" marker
-- (deliberately not localStorage, so it follows the client across
-- devices/browsers — see PLAN.md Section 3). NULL means "never completed or
-- dismissed"; the dashboard shows the onboarding tour whenever this is NULL,
-- regardless of whether rules/reasons already exist.
ALTER TABLE clients ADD COLUMN tutorial_completed_at TIMESTAMP NULL;

-- tier: no billing integration this pass — set directly in the DB (or via a
-- future admin-only toggle). Every premium-gated route must check this
-- server-side (never trust a client-supplied tier value) — see
-- lib/require-client.ts and PLAN.md Section 5.
ALTER TABLE clients ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free', 'premium'));

-- display_name: shown to visitors instead of the client's raw login email
-- (app/api/visitor/[clientLink]/availability/route.ts previously returned
-- `client.email` directly — see PLAN.md Section 1). Available to every
-- tier; the premium-only fields below layer custom branding on top.
ALTER TABLE clients ADD COLUMN display_name VARCHAR(255);

-- Premium feature 1 (custom branding): accent color + optional logo URL
-- rendered on the visitor booking page. Only ever returned to visitors when
-- the owning client's current tier is 'premium' (checked at request time,
-- not cached) — see app/api/visitor/[clientLink]/availability/route.ts.
ALTER TABLE clients ADD COLUMN accent_color VARCHAR(20);
ALTER TABLE clients ADD COLUMN logo_url TEXT;

-- Premium feature 2 (custom slug): short, memorable alternative to the raw
-- client UUID in /visit/[clientLink] links. Validated at the API layer to
-- be 3-30 lowercase letters/digits/hyphens, which makes a slug/UUID format
-- collision structurally impossible (a 36-char canonical UUID string can
-- never satisfy that format) — see lib/resolve-client-link.ts and PLAN.md
-- Section 5. A unique index (not a table-level UNIQUE column constraint,
-- so multiple clients can keep slug = NULL) enforces no two clients share a
-- slug. The slug value is left in place when a client downgrades to free
-- (resolve-client-link.ts stops honoring it, rather than this migration
-- deleting it), so it starts resolving again immediately on re-upgrade.
ALTER TABLE clients ADD COLUMN slug VARCHAR(30);
CREATE UNIQUE INDEX idx_clients_slug ON clients(slug) WHERE slug IS NOT NULL;

-- Premium feature 3 (SMS reminders) groundwork only — schema/gating pattern
-- is safe to ship without a live SMS provider; the actual send is stubbed
-- (see lib/sms.ts). This is the one client-controlled setting for it: a
-- per-client opt-in the cron job's query filters on alongside tier.
ALTER TABLE clients ADD COLUMN sms_reminders_enabled BOOLEAN NOT NULL DEFAULT false;

import { createServiceClient } from './supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a `[clientLink]` URL param (app/visit/[clientLink] and every
 * app/api/visitor/[clientLink]/* route) to a real client id. Centralizes
 * the one piece of logic all of those anonymous, unauthenticated routes
 * share, per PLAN.md Section 4 feature 2 / Section 5.
 *
 * Two shapes are accepted:
 *   - The client's raw UUID (`clients.id`) — always resolves, any tier.
 *   - A premium client's custom `slug` — only resolves while that client's
 *     *current* tier is 'premium', checked fresh on every call (not
 *     cached), so a downgraded client's slug stops resolving immediately.
 *     The slug row itself is left alone on downgrade (see the 0007
 *     migration) so it starts working again immediately on re-upgrade.
 *
 * A slug/UUID collision is structurally impossible: slugs are validated at
 * write time (lib/validation.ts `slugSchema`) to be 3-30 lowercase
 * letters/digits/hyphens, and a canonical 36-character UUID string can
 * never satisfy that format. So checking the UUID shape first and only
 * falling through to the slug lookup otherwise is unambiguous — no request
 * can be interpreted as "maybe either."
 */
export async function resolveClientLink(clientLink: string): Promise<{ clientId: string } | null> {
  const supabase = createServiceClient();

  if (UUID_RE.test(clientLink)) {
    const { data } = await supabase.from('clients').select('id').eq('id', clientLink).maybeSingle();
    return data ? { clientId: data.id } : null;
  }

  // Not UUID-shaped: only a premium client's slug can resolve here. Lookup
  // is lowercased for a friendlier "typed the link in caps" experience;
  // slugs are always stored lowercase (enforced by slugSchema's regex), so
  // this normalization can't create any new ambiguity.
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', clientLink.toLowerCase())
    .eq('tier', 'premium')
    .maybeSingle();
  return data ? { clientId: data.id } : null;
}

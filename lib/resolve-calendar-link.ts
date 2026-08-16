import { createServiceClient } from './supabase';
import { getEffectiveTier } from './premium-grants';
import { isAtLeast } from './tier';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a `[clientLink]` URL param (app/visit/[clientLink] and every
 * app/api/visitor/[clientLink]/* route) to a real `booking_calendars` row.
 * Link resolution moved here from `clients` directly once a client could
 * own several independently-linked calendars (0014-0016 migrations) —
 * replaces the old `lib/resolve-client-link.ts`. Returns both the calendar
 * id (what every booking-scoped query is now keyed on) and the owning
 * client id (still needed for the one thing that stayed client-level: the
 * Google refresh token).
 *
 * Two shapes are accepted, same as before:
 *   - The calendar's raw UUID (`booking_calendars.id`) — always resolves,
 *     any tier. For every calendar that existed before multi-calendar
 *     shipped, this UUID is literally the same as the owning client's own
 *     `clients.id` (0015's backfill gave every client a same-id calendar
 *     row), so every already-shared `/visit/` link keeps resolving exactly
 *     as before with zero visitor-facing disruption.
 *   - A slug on that calendar — only resolves while the *owning client's*
 *     current effective tier is premium-or-above (`booking_calendars` has
 *     no tier of its own), checked fresh on every call, never cached.
 *
 * A slug/UUID collision is still structurally impossible for the same
 * reason as before: slugs are validated at write time (`lib/validation.ts`
 * `slugSchema`) to be 3-30 lowercase letters/digits/hyphens, and a
 * canonical 36-character UUID string can never satisfy that format.
 */
export async function resolveCalendarLink(
  calendarLink: string
): Promise<{ calendarId: string; clientId: string } | null> {
  const supabase = createServiceClient();

  if (UUID_RE.test(calendarLink)) {
    const { data } = await supabase
      .from('booking_calendars')
      .select('id, client_id')
      .eq('id', calendarLink)
      .maybeSingle();
    return data ? { calendarId: data.id, clientId: data.client_id } : null;
  }

  // Not UUID-shaped: only a slug can resolve here, gated on the owning
  // client's effective tier. Lookup is lowercased for a friendlier "typed
  // the link in caps" experience — slugs are always stored lowercase
  // (enforced by slugSchema's regex).
  const { data } = await supabase
    .from('booking_calendars')
    .select('id, client_id, clients(email, tier)')
    .eq('slug', calendarLink.toLowerCase())
    .maybeSingle();
  if (!data) return null;

  // Supabase's nested-relation shape can come back as an object or a
  // single-element array depending on how it infers the join's cardinality
  // — handled defensively rather than assuming one or the other.
  const owner: any = Array.isArray((data as any).clients)
    ? (data as any).clients[0]
    : (data as any).clients;
  if (!owner) return null;

  const tier = await getEffectiveTier(owner.tier, owner.email);
  return isAtLeast(tier, 'premium') ? { calendarId: data.id, clientId: data.client_id } : null;
}
